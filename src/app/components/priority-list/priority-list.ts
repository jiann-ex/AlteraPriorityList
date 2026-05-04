import { Component, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Priority } from '../../types/priority';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { PriorityListService } from '../../services/priority-list';
import { PriorityListDataSource, SortState } from '../../services/priority-list-datasource';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

type SortDirection = 'asc' | 'desc' | null;

interface ColumnDef {
  key: keyof Priority;
  label: string;
  class?: string;
}

@Component({
  selector: 'app-priority-list',
  imports: [HlmTableImports, HlmSpinnerImports, HlmButtonImports, ScrollingModule, FormsModule],
  templateUrl: './priority-list.html',
  styleUrl: './priority-list.scss',
  host: {
    class: 'block w-full',
  },
})
export class PriorityList implements OnInit, OnDestroy {
  @ViewChild('tableViewport') viewport?: CdkVirtualScrollViewport;

  private readonly service = inject(PriorityListService);
  private readonly destroy$ = new Subject<void>();
  private readonly filterInput$ = new Subject<void>();

  dataSource!: PriorityListDataSource;
  isLoading = signal(false);
  totalCount = signal(0);

  sortColumn = signal<string | null>(null);
  sortDirection = signal<SortDirection>(null);

  filters: Record<string, string> = {};

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'ID', class: 'w-20' },
    { key: 'vpo', label: 'VPO' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'stepSequence', label: 'Step' },
    { key: 'priority', label: 'Priority', class: 'w-20' },
    { key: 'r1', label: 'R1', class: 'w-16 text-right' },
    { key: 'r2', label: 'R2', class: 'w-16 text-right' },
    { key: 'vpoForecastQuantity', label: 'Forecast Qty', class: 'text-right' },
    { key: 'testTimePerUnit', label: 'Test Time', class: 'text-right' },
  ];

  ngOnInit(): void {
    this.dataSource = new PriorityListDataSource(this.service);

    this.dataSource.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => this.isLoading.set(loading));

    this.dataSource.totalCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => this.totalCount.set(count));

    // Debounce filter input to avoid spamming API
    this.filterInput$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.dataSource.setFilters({ ...this.filters });
      this.viewport?.scrollToIndex(0);
    });

    // Initial load
    this.dataSource.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSort(column: string): void {
    if (this.sortColumn() === column) {
      // Cycle: asc -> desc -> none
      const current = this.sortDirection();
      if (current === 'asc') {
        this.sortDirection.set('desc');
      } else if (current === 'desc') {
        this.sortColumn.set(null);
        this.sortDirection.set(null);
        this.dataSource.setSort(null);
        this.viewport?.scrollToIndex(0);
        return;
      }
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }

    this.dataSource.setSort({
      column: this.sortColumn()!,
      direction: this.sortDirection()! as 'asc' | 'desc',
    });
    this.viewport?.scrollToIndex(0);
  }

  onFilterChange(): void {
    this.filterInput$.next();
  }

  getSortIcon(column: string): string {
    if (this.sortColumn() !== column) return '↕';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  getCellValue(item: Priority | undefined, key: keyof Priority): string {
    if (!item) return '';
    const val = item[key];
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? '✓' : '';
    return String(val);
  }
}
