import { CollectionViewer, DataSource, ListRange } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { Priority } from '../types/priority';
import { PriorityListService, PriorityQuery, Query } from './priority-list.service';
import type { PriorityData } from '../types';
import { computed, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';

/**
 * Scroll debounce time in milliseconds, meaning wait 300ms after user stop scroll
 * Prevent trigger unintended request when user scrolling fast
 */
const SCROLL_DEBOUNCE_TIME = 300;
/**
 * Allow to filter multiple values or single value for a single column,
 * e.g. filter r1 with both 1 and 3 to show all items with r1=1 or r1=3
 */
export type FilterState = Record<keyof Priority, string[] | string>;

/**
 * DataSource for the priority list, handling server-side pagination, sorting, and filtering.
 * Feed to cdk-virtual-scroll-viewport to provide an infinite scrolling experience.
 */
export class PriorityListDataSource extends DataSource<PriorityData> {
  private _data: PriorityData[] = [];
  private data!: BehaviorSubject<PriorityData[]>;
  private readonly loading = new BehaviorSubject<boolean>(false);
  private readonly totalCount;
  private destroy$ = new Subject<void>();
  /** Stored set of fetched list range to prevent refetch same thing again */
  private fetched = new Set<ListRange>();
  private _sortColumn: string | null = null;
  private _sortDirection: 'asc' | 'desc' | null = null;

  readonly loading$ = this.loading.asObservable();
  get totalCount$() {
    return this.totalCount.asObservable();
  }

  /**
   * Stored edited items and update the data to the edited one
   * when there is match with the id
   */
  private readonly _editedItems = signal<Map<string, PriorityData>>(new Map());
  /** Original state of items before any edits, used to detect full revert */
  private readonly _originalItems = new Map<string, PriorityData>();
  readonly editedItems = computed(() => Array.from(this._editedItems().values()));
  readonly totalEdited = computed(() => this._editedItems().size);

  constructor(
    private readonly service: PriorityListService,
    private readonly groupKey: number | null,
    readonly initialTotal: number = 0,
  ) {
    super();
    this.totalCount = new BehaviorSubject<number>(this.initialTotal);
    this._data = Array.from({ length: initialTotal }, () => null);
  }

  private _initData() {
    this._data = Array.from({ length: this.totalCount.value }, () => null);
  }

  /** Initialize all subjects */
  private _init() {
    this.data = new BehaviorSubject<PriorityData[]>([]);
    this.destroy$ = new Subject<void>();
  }
  /** Clean up all subjects to prevent memory leaks */
  private _destroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.data.complete();
  }

  destroy() {
    this._destroy();
    this.loading.complete();
    this.totalCount.complete();
    this._data.length = 0;
  }

  connect(collectionViewer: CollectionViewer): Observable<PriorityData[]> {
    this._init();
    //this.data.next(this._data);
    collectionViewer.viewChange
      .pipe(
        // Only trigger if the start or end of the view range changed,
        // prevent trigger when user scrolls within the same range
        distinctUntilChanged((a, b) => a.start === b.start && a.end === b.end),
        // Add debounce to prevent too many calls during fast scrolling
        // Once user stop scrolling for {SCROLL_DEBOUNCE_TIME}ms,
        // then fetch the data for the current range
        debounceTime(SCROLL_DEBOUNCE_TIME),
        takeUntil(this.destroy$),
      )
      .subscribe((range) => {
        this._fetchRange(range);
      });

    this.data.next(this._data);
    // In template, can directly use in *cdkVirtualFor="let item of dataSource"
    return this.data.asObservable();
  }

  disconnect(): void {
    // Under @if after disconnect get call when destroyed, causing the *cdkVirtualFor to be empty,
    // need to complete the subjects to prevent any further emissions
    this._destroy();
  }

  refresh(): void {
    //this._reset();
    //this.data.next(this._data);
  }

  // Eventho replace with new instance is recommended
  // But i think its expensive to create new instance every time when edit an item
  editItem(index: number, priority: Priority, field: keyof Priority, value: unknown): void {
    const current = this.data.value;
    const item = current[index];

    if (!item) return;

    // Store the original state before the first edit
    if (!this._originalItems.has(priority.id)) {
      this._originalItems.set(priority.id, { ...item });
    }

    current[index] = { ...item, [field]: value };
    this.data.next(current);
    this._editedItems.update((prev) => {
      const newMap = new Map(prev);
      newMap.set(priority.id, current[index]);
      return newMap;
    });
  }

  /** Revert a single field edit on an item at the given index. */
  undoEdit(index: number, priority: Priority, field: keyof Priority, previousValue: unknown): void {
    const current = this._data;
    const item = current[index];
    if (!item) return;

    toast('An edit has been undone.', {
      description: `Field "${field}" reverted to previous value.`,
      position: 'top-center',
    });

    current[index] = { ...item, [field]: previousValue };
    this.data.next(current);

    // Check if the item is back to its original fetched state — if so, remove from edited map
    const original = this._originalItems.get(priority.id);
    if (original && JSON.stringify(current[index]) === JSON.stringify(original)) {
      this._editedItems.update((prev) => {
        const newMap = new Map(prev);
        newMap.delete(priority.id);
        return newMap;
      });
      this._originalItems.delete(priority.id);
    } else {
      this._editedItems.update((prev) => {
        const newMap = new Map(prev);
        newMap.set(priority.id, current[index]);
        return newMap;
      });
    }
  }
  private _reset(): void {
    this.fetched.clear();
    // Clear current data to prevent mismatch between the data and the sort state, user will see empty list with new sort applied, then the data will be filled in when the new request returns
    this._initData();
    // Trigger data update to refresh the view, if not trigger, the view will still show the old data until user scrolls to trigger the fetch with new sort, which might cause confusion
    this.data.next(Array.from({ length: 8 }, () => null));
  }
  /**
   * Empty the data source without resetting the fetched ranges or total count.
   * For to close the expanded row, clear the data will not making the cdk viewport confusing with the height calculation
   *
   * Public method for the expandable component to call this function when collapse the group
   */
  empty(): void {
    this.data.next([]);
  }

  sort(column: string | null, direction: 'asc' | 'desc' | null): void {
    // Clear fetched cache to allow refetch with new sort
    this.fetched.clear();
    this._sortColumn = column;
    this._sortDirection = direction;
    this._reset();
  }

  private _isRangeFetched(range: ListRange): boolean {
    for (const fetchedRange of this.fetched) {
      if (range.start >= fetchedRange.start && range.end <= fetchedRange.end) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate offset and limit based on the given range,
   * then call API to fetch the data.
   * @param range
   */
  private _fetchRange(range: ListRange): void {
    const offset = range.start;
    const limit = range.end - range.start;

    if (this._isRangeFetched(range)) {
      console.log(`Range ${range.start}-${range.end} already fetched, skip API call.`);
      return;
    }
    this._fetchPage(offset, limit, range);
  }

  private _fetchPage(offset: number, limit: number, range: ListRange): void {
    if (range) {
      this.fetched.add(range);
    }

    this.loading.next(true);

    const query: PriorityQuery = {
      offset: offset,
      limit: limit,
      sort: this._sortColumn ?? undefined,
      sortDirection: this._sortDirection,
    };

    this.service
      .getPriorityListByGroup(this.groupKey, query)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.next(false)),
      )
      .subscribe({
        next: (response) => {
          const total = response.count;
          this.totalCount.next(total);

          // Expand the sparse array to match total size
          let current = this._data;
          // In this case, we have newer version of the list
          // The old _data might not valid anymore, so we need to create a new one with the new total size
          if (current.length < total) {
            // Rearrange _data as the order might not correct, might have duplicate display with the wrong order,
            // need to rearrange it to the correct order with the offset and limit
            // To be simple, just recreate the old array
            this._data = Array.from({ length: total }, () => null);
            current = this._data;
          }

          // Place fetched items at the correct offset
          const offset = query.offset;
          for (let i = 0; i < response.data.length; i++) {
            if (this._editedItems().has(response.data[i].id)) {
              response.data[i] = this._editedItems().get(response.data[i].id)!;
            } else {
              current[offset + i] = response.data[i];
            }
          }

          this.data.next(current);
        },
        error: () => {
          // Allow retry on next scroll
          console.error(
            `Failed to fetch data for range ${range.start}-${range.end}, removing from fetched set to allow retry.`,
          );
          this.fetched.delete(range);
        },
      });
  }

  /** Update a single item in the local cache (after API confirms the save). */
  updateItem(index: number, field: keyof Priority, value: unknown): void {
    const current = this.data.value.slice();
    const item = current[index];
    if (item) {
      (current[index] as any) = { ...item, [field]: value };
      this.data.next(current);
    }
  }
}
