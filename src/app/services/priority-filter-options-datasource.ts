import { CollectionViewer, DataSource, ListRange } from '@angular/cdk/collections';
import { NullableString } from '@app-types/nullable';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  finalize,
  Observable,
  Subject,
  takeUntil,
} from 'rxjs';
import { PriorityListService, Query } from './priority-list.service';
import { PriorityResponse } from '@app-types/priority';

/**
 * Scroll debounce time in milliseconds, meaning wait 300ms after user stop scroll
 * Prevent trigger unintended request when user scrolling fast
 */
const SCROLL_DEBOUNCE_TIME = 300;

export class PriorityFilterOptionsDataSource extends DataSource<NullableString> {
  private _data: NullableString[] = [];
  private data!: BehaviorSubject<NullableString[]>;
  private readonly loading = new BehaviorSubject<boolean>(false);
  private destroy$ = new Subject<void>();

  /** Stored set of fetched list range to prevent refetch same thing again */
  private fetched = new Set<ListRange>();

  /** Search term */
  private _term: string | null = null;

  constructor(
    private readonly service: PriorityListService,
    private readonly col: keyof PriorityResponse,
  ) {
    super();
    this._data = Array.from({ length: 8 }, () => null);
  }

  /** Initialize all subjects */
  private _init() {
    this.data = new BehaviorSubject<NullableString[]>([]);
    this.destroy$ = new Subject<void>();
  }
  /** Clean up all subjects to prevent memory leaks */
  private _destroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.data.complete();
  }

  search(term: string | null): void {
    // Clear fetched cache to allow refetch with new search term
    this.fetched.clear();
    // Clear current data to show loading state in the UI
    this._data = Array.from({ length: 8 }, () => null);
    this.data.next(this._data);

    this._term = term;
  }

  override connect(collectionViewer: CollectionViewer): Observable<readonly NullableString[]> {
    this._init();

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
        console.log('View range changed:', range);
        this._fetchRange(range);
      });

    this.data.next(this._data);
    // In template, can directly use in *cdkVirtualFor="let item of dataSource"
    return this.data.asObservable();
  }
  override disconnect(): void {
    this._destroy();
  }

  private _isRangeFetched(range: ListRange): boolean {
    for (const fetchedRange of this.fetched) {
      if (range.start >= fetchedRange.start && range.end <= fetchedRange.end) {
        return true;
      }
    }
    return false;
  }

  private _fetchRange(range: ListRange): void {
    const offset = range.start;
    const limit = range.end - range.start;

    if (this._isRangeFetched(range)) {
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

    this.service
      .getPriorityFilterOptions(this.col, query, this._term)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.next(false)),
      )
      .subscribe({
        next: (response) => {
          const total = response.count;
          //this.totalCount.next(total);

          // Expand the sparse array to match total size
          let current = this._data;
          // In this case, we have newer version of the list
          // The old _data might not valid anymore, so we need to create a new one with the new total size
          if (current.length != total) {
            // Rearrange _data as the order might not correct, might have duplicate display with the wrong order,
            // need to rearrange it to the correct order with the offset and limit
            // To be simple, just recreate the old array
            this._data = Array.from({ length: total }, () => null);
            current = this._data;
          }

          // Place fetched items at the correct offset
          const offset = query.offset;
          for (let i = 0; i < response.data.length; i++) {
            current[offset + i] = response.data[i];
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
}
