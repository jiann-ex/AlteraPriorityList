import { CollectionViewer, DataSource, ListRange } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';

/**
 * Represents a group header in the flattened virtual scroll list.
 */
export interface GroupHeaderRow<T> {
  type: 'group';
  key: string;
  label: string;
  expanded: boolean;
  count: number;
}

/**
 * Represents a data row in the flattened virtual scroll list.
 * `item` is undefined for unfetched placeholder rows.
 */
export interface DataRow<T> {
  type: 'data';
  item: T | undefined;
  groupKey: string;
}

/**
 * A row in the flattened list is either a group header or a data item.
 * So that it can easily render the table.
 */
export type FlatRow<T> = GroupHeaderRow<T> | DataRow<T>;

export interface GroupConfig<T> {
  /** Function that extracts the group key from an item */
  groupBy: (item: T) => string;
  /** Optional label formatter for the group header (defaults to key) */
  labelFn?: (key: string, count: number) => string;
  /** Optional sort comparator for group order */
  groupSort?: (a: string, b: string) => number;
}

/**
 * Configuration for the paginated fetch function.
 * The datasource calls this to request a page of data.
 */
export interface PageFetchFn<T> {
  (page: number, pageSize: number): Observable<{ data: T[]; count: number }>;
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * A grouped DataSource with infinite scroll support.
 *
 * How it works:
 * 1. On first connect, fetches page 0 to learn the total count and initial data.
 * 2. Groups items by `config.groupBy`. Unfetched slots are `undefined`.
 * 3. As the user scrolls, `CollectionViewer.viewChange` triggers fetching
 *    the pages corresponding to the visible flat row range.
 * 4. When data arrives, items fill in and groups are rebuilt, preserving expand state.
 *
 * Usage:
 * ```ts
 * const grouped = new GroupedDataSource<Priority>(
 *   { groupBy: (item) => String(item.priority), labelFn: (key, count) => `${key} (${count})` },
 *   (page, pageSize) => service.getPriorityList({ page, pageSize }),
 * );
 * ```
 */
export class GroupedDataSource<T> extends DataSource<FlatRow<T>> {
  private readonly flatRows$ = new BehaviorSubject<FlatRow<T>[]>([]);
  private readonly loading$ = new BehaviorSubject<boolean>(false);
  private readonly destroy$ = new Subject<void>();

  /** Sparse array of all items, sized to totalCount. undefined = not yet fetched. */
  private items: (T | undefined)[] = [];
  private totalCount = 0;
  private fetchedPages = new Set<number>();
  private expandedState = new Map<string, boolean>();

  readonly loading = this.loading$.asObservable();

  get length(): number {
    return this.flatRows$.value.length;
  }

  get total(): number {
    return this.totalCount;
  }

  private sort: { column: string; direction: 'asc' | 'desc' } | null = null;
  private filters: Record<string, string> = {};

  constructor(
    private readonly config: GroupConfig<T>,
    private fetchFn: PageFetchFn<T>,
    private readonly pageSize: number = DEFAULT_PAGE_SIZE,
  ) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<FlatRow<T>[]> {
    // React to scroll position changes
    collectionViewer.viewChange
      .pipe(
        distinctUntilChanged((a, b) => a.start === b.start && a.end === b.end),
        takeUntil(this.destroy$),
      )
      .subscribe((range) => this.onViewChange(range));

    // Kick off initial fetch
    this.fetchPage(0);

    return this.flatRows$.asObservable();
  }

  disconnect(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.flatRows$.complete();
    this.loading$.complete();
  }

  setGroups(groups: GroupHeaderRow<T>[]): void {}

  /** Toggle a group's expanded state by key. */
  toggleGroup(key: string): void {
    const current = this.expandedState.get(key) ?? true;
    this.expandedState.set(key, !current);
    this.flatten();
  }

  /** Set a group's expanded state explicitly. */
  setGroupExpanded(key: string, expanded: boolean): void {
    this.expandedState.set(key, expanded);
    this.flatten();
  }

  /** Expand all groups. */
  expandAll(): void {
    for (const key of this.expandedState.keys()) {
      this.expandedState.set(key, true);
    }
    this.flatten();
  }

  /** Collapse all groups. */
  collapseAll(): void {
    for (const key of this.expandedState.keys()) {
      this.expandedState.set(key, false);
    }
    this.flatten();
  }

  /** Returns whether a given group is currently expanded */
  isExpanded(key: string): boolean {
    return this.expandedState.get(key) ?? true;
  }

  /** Reset state and refetch. Call after sort/filter changes. */
  refresh(): void {
    this.items = [];
    this.totalCount = 0;
    this.fetchedPages.clear();
    this.flatRows$.next([]);
    this.fetchPage(0);
  }

  /** Set sort and re-fetch from scratch. */
  setSort(sort: { column: string; direction: 'asc' | 'desc' } | null): void {
    this.sort = sort;
    this.refresh();
  }

  /** Set filters and re-fetch from scratch. */
  setFilters(filters: Record<string, string>): void {
    this.filters = filters;
    this.refresh();
  }

  /** Update the fetch function (e.g. to include new sort/filter params). */
  setFetchFn(fn: PageFetchFn<T>): void {
    this.fetchFn = fn;
  }

  /**
   * Get the data item at a given flat row index.
   * Returns undefined if the row is a group header or unfetched.
   */
  getItemAtFlatIndex(flatIndex: number): T | undefined {
    const row = this.flatRows$.value[flatIndex];
    if (!row || row.type === 'group') return undefined;
    return row.item;
  }

  /** Update a single item in the local cache by its flat row index. */
  updateItemAtFlatIndex(flatIndex: number, field: keyof T, value: unknown): void {
    const row = this.flatRows$.value[flatIndex];
    if (!row || row.type !== 'data' || !row.item) return;

    // Find and update in the source items array
    const sourceIdx = this.items.indexOf(row.item);
    if (sourceIdx !== -1) {
      this.items[sourceIdx] = { ...row.item, [field]: value } as T;
      this.flatten();
    }
  }

  /** Update a single item in the local cache by its index in the sparse array. */
  updateItem(sourceIndex: number, field: keyof T, value: unknown): void {
    const item = this.items[sourceIndex];
    if (item) {
      this.items[sourceIndex] = { ...item, [field]: value } as T;
      this.flatten();
    }
  }

  // --- Private ---

  private onViewChange(range: ListRange): void {
    // Map visible flat-row range back to source indices and determine which pages to fetch.
    // We use a conservative approach: figure out which source-level pages might be needed
    // based on the flat row indices.
    const startSource = Math.max(0, range.start - this.getGroupHeaderCountBefore(range.start));
    const endSource = Math.min(
      this.totalCount,
      range.end - this.getGroupHeaderCountBefore(range.end) + this.pageSize,
    );

    const startPage = Math.floor(startSource / this.pageSize);
    const endPage = Math.floor(Math.max(0, endSource - 1) / this.pageSize);

    console.log('View Change: ', startPage, endPage);
    // for (let page = startPage; page <= endPage; page++) {
    //   this.fetchPage(page);
    // }
  }

  /** Approximate number of group headers before a given flat index */
  private getGroupHeaderCountBefore(flatIndex: number): number {
    const rows = this.flatRows$.value;
    let count = 0;
    for (let i = 0; i < flatIndex && i < rows.length; i++) {
      if (rows[i].type === 'group') count++;
    }
    return count;
  }

  private fetchPage(pageIndex: number): void {
    if (this.fetchedPages.has(pageIndex)) return;
    this.fetchedPages.add(pageIndex);

    this.loading$.next(true);

    this.fetchFn(pageIndex + 1, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.totalCount = response.count;

          // Expand sparse array to total size
          if (this.items.length < this.totalCount) {
            this.items.length = this.totalCount;
          }

          // Place fetched items at the correct offset
          const offset = pageIndex * this.pageSize;
          for (let i = 0; i < response.data.length; i++) {
            this.items[offset + i] = response.data[i];
          }

          this.flatten();
          this.loading$.next(false);
        },
        error: () => {
          // Allow retry on next scroll
          this.fetchedPages.delete(pageIndex);
          this.loading$.next(false);
        },
      });
  }

  /** Build the flat list from current items grouped + expanded state */
  private flatten(): void {
    const { groupBy, labelFn, groupSort } = this.config;

    // Group defined items
    const groupMap = new Map<string, { items: (T | undefined)[]; indices: number[] }>();

    // We also need to track ungrouped (unfetched) items — assign them to a placeholder group
    // Strategy: iterate all slots. Defined items get grouped; undefined items stay in order.
    // To keep virtual scroll indexing predictable, undefined items go into a special "loading" bucket
    // per their probable group (we don't know yet). Instead, we group only defined items
    // and append unfetched items at the end as a "Loading..." group.

    const ungroupedIndices: number[] = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item !== undefined) {
        const key = groupBy(item);
        if (!groupMap.has(key)) {
          groupMap.set(key, { items: [], indices: [] });
        }
        const group = groupMap.get(key)!;
        group.items.push(item);
        group.indices.push(i);
      } else {
        ungroupedIndices.push(i);
      }
    }

    // Sort group keys
    let keys = Array.from(groupMap.keys());
    if (groupSort) {
      keys = keys.sort(groupSort);
    }

    const rows: FlatRow<T>[] = [];
    //console.log('Flatten keys:', keys);
    for (const key of keys) {
      const group = groupMap.get(key)!;
      const expanded = this.expandedState.get(key) ?? true;

      // Ensure expand state is tracked
      if (!this.expandedState.has(key)) {
        this.expandedState.set(key, true);
      }

      rows.push({
        type: 'group',
        key,
        label: labelFn ? labelFn(key, group.items.length) : key,
        expanded,
        count: group.items.length,
      });

      if (expanded) {
        for (const item of group.items) {
          rows.push({ type: 'data', item, groupKey: key });
        }
      }
    }

    // Add unfetched rows as placeholder data rows (no group header for them)
    // They appear at the bottom and will be regrouped once fetched
    if (ungroupedIndices.length > 0) {
      rows.push({
        type: 'group',
        key: '__loading__',
        label: `Loading... (${ungroupedIndices.length} remaining)`,
        expanded: this.expandedState.get('__loading__') ?? true,
        count: ungroupedIndices.length,
      });

      if (this.expandedState.get('__loading__') ?? true) {
        for (const _idx of ungroupedIndices) {
          rows.push({ type: 'data', item: undefined, groupKey: '__loading__' });
        }
      }
    }
    console.log('Flattened rows:', rows);

    this.flatRows$.next(rows);
  }
}
