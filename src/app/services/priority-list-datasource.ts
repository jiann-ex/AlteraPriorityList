import { CollectionViewer, DataSource, ListRange } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { debounce, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Priority } from '../types/priority';
import { PriorityListService, Query } from './priority-list.service';
import type { PriorityData } from '../types';

const PAGE_SIZE = 50;
/**
 * Scroll debounce time in milliseconds, meaning wait 300ms after user stop scroll
 * Prevent trigger unintended request when user scrolling fast
 */
const SCROLL_DEBOUNCE_TIME = 300;

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}
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
  private data = new BehaviorSubject<PriorityData[]>([]);
  private loading = new BehaviorSubject<boolean>(false);
  private totalCount = new BehaviorSubject<number>(0);
  private destroy$ = new Subject<void>();
  /** Stored set of fetched list range to prevent refetch same thing again */
  private fetched = new Set<ListRange>();

  readonly loading$ = this.loading.asObservable();
  readonly totalCount$ = this.totalCount.asObservable();
  readonly data$ = this.data.asObservable();
  /**
   * Stored edited items and update the data to the edited one
   * when there is match with the id
   */
  private readonly _editedItems: Map<number, Priority> = new Map();

  constructor(
    private readonly service: PriorityListService,
    private readonly groupKey: number | null,
  ) {
    super();
  }

  private _init() {
    this.data = new BehaviorSubject<PriorityData[]>([]);
    this.loading = new BehaviorSubject<boolean>(false);
    this.totalCount = new BehaviorSubject<number>(0);
    this.destroy$ = new Subject<void>();
  }
  private _destroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.data.complete();
    this.loading.complete();
    this.totalCount.complete();
  }

  connect(collectionViewer: CollectionViewer): Observable<PriorityData[]> {
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
        console.log(this.data.value.length);
        this._fetchRange(range);
      });
    // In template, can directly use in *cdkVirtualFor="let item of dataSource"
    return this.data.asObservable();
  }

  disconnect(): void {
    console.log('DataSource disconnected R1:', this.groupKey);
    // Under @if after disconnect get call when destroyed, causing the *cdkVirtualFor to be empty,
    // need to complete the subjects to prevent any further emissions
    // this.destroy$.next();
    // this.destroy$.complete();
    // this.data.complete();
    // this.loading.complete();
    // this.totalCount.complete();
  }

  refresh(): void {
    this._reset();
  }

  // Eventho replace with new instance is recommended
  // But i think its expensive to create new instance every time when edit an item
  editItem(index: number, field: keyof Priority, value: unknown): void {
    const current = this.data.value;
    const item = current[index];

    if (!item) return;

    current[index] = { ...item, [field]: value };
    this.data.next(current);
    this._editedItems.set(index, current[index]);
    console.log(`Update items`, current[index], current);
  }

  private _reset(): void {
    this.fetched.clear();
    this.data.next([]);
    this.totalCount.next(0);
    // Fetch first page immediately to get totalCount and initial data
    this._fetchRange({ start: 0, end: PAGE_SIZE });
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

    const query: Query = {
      offset: offset,
      limit: limit,
    };

    this.service.getPriorityListByGroup(this.groupKey, query).subscribe({
      next: (response) => {
        const total = response.count;
        this.totalCount.next(total);

        // Expand the sparse array to match total size
        const current = this.data.value;
        if (current.length < total) {
          current.length = total;
        }

        // Place fetched items at the correct offset
        //const offset = pageIndex * PAGE_SIZE;
        const offset = query.offset;
        for (let i = 0; i < response.data.length; i++) {
          if (this._editedItems.has(offset + i)) {
            response.data[i] = this._editedItems.get(offset + i)!;
          } else {
            current[offset + i] = response.data[i];
          }
        }

        this.data.next(current);
        this.loading.next(false);
      },
      error: () => {
        // Allow retry on next scroll
        //this.fetchedPages.delete(pageIndex);
        this.loading.next(false);
      },
    });
  }

  /** Retrieve list of edited items ready send to the backend */
  getEditedItems(): Priority[] {
    return Array.from(this._editedItems.values());
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
