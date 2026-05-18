import { CollectionViewer, DataSource, ListRange } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Priority } from '../types/priority';
import { PriorityListService, PriorityQuery, Query } from './priority-list.service';
import type { PriorityData } from '../types';

const PAGE_SIZE = 50;

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
  private readonly data = new BehaviorSubject<PriorityData[]>([]);
  private readonly loading = new BehaviorSubject<boolean>(false);
  private readonly totalCount = new BehaviorSubject<number>(0);
  private readonly destroy$ = new Subject<void>();

  private fetchedPages = new Set<string>();

  private sort: SortState | null = null;
  private filters: Record<string, string> = {};

  readonly loading$ = this.loading.asObservable();
  readonly totalCount$ = this.totalCount.asObservable();
  readonly data$ = this.data.asObservable();

  constructor(
    private readonly service: PriorityListService,
    private readonly groupKey: number | null,
  ) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<PriorityData[]> {
    console.log('DataSource connected R1:', this.groupKey);
    collectionViewer.viewChange
      .pipe(
        distinctUntilChanged((a, b) => a.start === b.start && a.end === b.end),
        takeUntil(this.destroy$),
      )
      .subscribe((range) => {
        console.log('View range changed:', range);
        this.fetchRange(range);
      });
    this.fetchRange({ start: 0, end: PAGE_SIZE }); // Fetch initial range
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

  setSort(sort: SortState | null): void {
    this.sort = sort;
    this.reset();
  }

  setFilters(filters: Record<string, string>): void {
    this.filters = filters;
    this.reset();
  }

  refresh(): void {
    this.reset();
  }

  private reset(): void {
    this.fetchedPages.clear();
    this.data.next([]);
    this.totalCount.next(0);
    // Fetch first page immediately to get totalCount and initial data
    this.fetchPage(0, PAGE_SIZE);
  }

  private fetchRange(range: ListRange): void {
    const offset = range.start;
    const limit = range.end - range.start;

    const startPage = Math.floor(range.start / PAGE_SIZE);
    const endPage = Math.floor((range.end - 1) / PAGE_SIZE);

    // for (let page = startPage; page <= endPage; page++) {
    //   this.fetchPage(page);
    // }
    this.fetchPage(offset, limit);
  }

  private fetchPage(offset: number, limit: number): void {
    // if (this.fetchedPages.has(pageIndex)) return;
    // this.fetchedPages.add(pageIndex);

    this.loading.next(true);

    const query: Query = {
      offset: offset,
      limit: limit,
    };

    this.service.getPriorityListByGroup(this.groupKey, query).subscribe({
      next: (response) => {
        const total = response.count;
        this.totalCount.next(total);
        console.log(`Fetched page for group, total=${total}`);

        // Expand the sparse array to match total size
        const current = this.data.value.slice();
        if (current.length < total) {
          current.length = total;
        }

        // Place fetched items at the correct offset
        //const offset = pageIndex * PAGE_SIZE;
        const offset = query.offset;
        for (let i = 0; i < response.data.length; i++) {
          current[offset + i] = response.data[i];
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
