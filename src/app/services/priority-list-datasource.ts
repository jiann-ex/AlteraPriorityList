import { CollectionViewer, DataSource, ListRange } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Priority } from '../types/priority';
import { PriorityListService, PriorityQuery } from './priority-list';

const PAGE_SIZE = 50;

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * DataSource for the priority list, handling server-side pagination, sorting, and filtering.
 * Feed to cdk-virtual-scroll-viewport to provide an infinite scrolling experience.
 */
export class PriorityListDataSource extends DataSource<Priority | undefined> {
  private readonly data = new BehaviorSubject<(Priority | undefined)[]>([]);
  private readonly loading = new BehaviorSubject<boolean>(false);
  private readonly totalCount = new BehaviorSubject<number>(0);
  private readonly destroy$ = new Subject<void>();

  private fetchedPages = new Set<number>();

  private sort: SortState | null = null;
  private filters: Record<string, string> = {};

  readonly loading$ = this.loading.asObservable();
  readonly totalCount$ = this.totalCount.asObservable();
  readonly data$ = this.data.asObservable();

  get length(): number {
    return this.totalCount.value;
  }

  constructor(private readonly service: PriorityListService) {
    super();
    console.log('PriorityListDataSource initialized');
  }

  connect(collectionViewer: CollectionViewer): Observable<(Priority | undefined)[]> {
    collectionViewer.viewChange
      .pipe(
        distinctUntilChanged((a, b) => a.start === b.start && a.end === b.end),
        takeUntil(this.destroy$),
      )
      .subscribe((range) => {
        console.log('View range changed:', range);
        this.fetchRange(range);
      });

    return this.data.asObservable();
  }

  disconnect(): void {
    console.log('Disconnecting data source');
    this.destroy$.next();
    this.destroy$.complete();
    this.data.complete();
    this.loading.complete();
    this.totalCount.complete();
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
    this.fetchPage(0);
  }

  private fetchRange(range: ListRange): void {
    const startPage = Math.floor(range.start / PAGE_SIZE);
    const endPage = Math.floor((range.end - 1) / PAGE_SIZE);

    console.log(`Fetching pages ${startPage} to ${endPage} for range ${range.start}-${range.end}`);
    for (let page = startPage; page <= endPage; page++) {
      this.fetchPage(page);
    }
  }

  private fetchPage(pageIndex: number): void {
    if (this.fetchedPages.has(pageIndex)) return;
    this.fetchedPages.add(pageIndex);

    this.loading.next(true);

    const query: PriorityQuery = {
      page: pageIndex + 1, // API is 1-indexed
      pageSize: PAGE_SIZE,
      sort: this.sort?.column,
      sortDirection: this.sort?.direction,
      filters: this.filters,
    };

    console.log('Fetching page with query:', query);
    this.service.getPriorityList(query).subscribe({
      next: (response) => {
        console.log('Received response for page', response);
        const total = response.count;
        this.totalCount.next(total);

        // Expand the sparse array to match total size
        const current = this.data.value.slice();
        if (current.length < total) {
          current.length = total;
        }

        // Place fetched items at the correct offset
        const offset = pageIndex * PAGE_SIZE;
        for (let i = 0; i < response.data.length; i++) {
          current[offset + i] = response.data[i];
        }

        this.data.next(current);
        this.loading.next(false);
      },
      error: () => {
        // Allow retry on next scroll
        this.fetchedPages.delete(pageIndex);
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
