import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  ViewChild,
} from '@angular/core';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Priority, PriorityGroup } from '../../types/priority';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { PriorityListService } from '../../services/priority-list.service';
import {
  GroupedDataSource,
  FlatRow,
  GroupHeaderRow,
  DataRow,
} from '../../services/grouped-datasource';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, finalize, takeUntil } from 'rxjs/operators';
import type { ColumnDef } from '../../types/column-def';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { SortDirection } from '@app-types';
import { PriorityListTh } from '../priority-list-th/priority-list-th';
import { createColumnWidths } from '../priority-list-th';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { GridTableImports } from '../grid-table/grid-table';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowRight,
  lucideCircleChevronDown,
  lucideCircleChevronRight,
} from '@ng-icons/lucide';
import { PriorityListDataSource } from '../../services/priority-list-datasource';
import { AsyncPipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-priority-list',
  imports: [
    HlmTableImports,
    HlmSpinnerImports,
    HlmButtonImports,
    ScrollingModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
    PriorityListTh,
    HlmDropdownMenuImports,
    GridTableImports,
    HlmTooltipImports,
    HlmSkeletonImports,
    NgIcon,
    NgClass,
    AsyncPipe,
  ],
  templateUrl: './priority-list.html',
  styleUrl: './priority-list.scss',
  host: {
    class: 'block w-full',
  },
  viewProviders: [
    provideIcons({
      lucideCircleChevronRight,
      lucideCircleChevronDown,
    }),
  ],
})
export class PriorityList implements OnInit, OnDestroy {
  @ViewChild('tableViewport') viewport?: CdkVirtualScrollViewport;

  private readonly service = inject(PriorityListService);
  private readonly destroy$ = new Subject<void>();

  groupedSource!: GroupedDataSource<Priority>;
  isLoading = signal(false);
  totalCount = signal(0);

  priorityGrouped = signal<PriorityGroup | null>(null);
  /** ToString the r1 to make it use as the key, feed to the Data Source to query based on the key (r1) */
  priorityDataSources = signal<Record<string, PriorityListDataSource>>({});
  groupExpanded = signal<Record<number, boolean>>({});

  sortColumn = signal<string | null>(null);
  sortDirection = signal<SortDirection>(null);

  testToggleTable = signal(false);

  filters: Record<string, string> = {};

  protected readonly columns = signal<ColumnDef[]>([
    { key: 'id', label: 'ID' },
    { key: 'vpo', label: 'VPO' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'stepSequence', label: 'Step' },
    { key: 'priority', label: 'Priority', editable: true },
    { key: 'r1', label: 'R1', class: 'text-right', editable: false },
    { key: 'r2', label: 'R2', class: 'text-right', editable: false },
    { key: 'vpoForecastQuantity', label: 'Forecast Qty', class: 'text-right' },
    { key: 'testTimePerUnit', label: 'Test Time', class: 'text-right' },
  ]);

  columnWidths = signal<Record<string, number>>(
    createColumnWidths(this.columns().map((c) => c.key)),
  );

  gridTemplateColumns = computed(() => {
    const widths = this.columnWidths();
    const columns = this.columns();
    return columns.map((col) => `${widths[col.key]}px`).join(' ');
  });

  onColumnResize(columnKey: string, width: number): void {
    this.columnWidths.update((prev) => ({ ...prev, [columnKey]: width }));
  }

  ngOnInit(): void {
    this.service
      .getPriorityGroups()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.priorityGrouped.set(res);
        this.priorityDataSources.set(
          Object.fromEntries(
            res.data.map((group) => [
              String(group.r1),
              new PriorityListDataSource(this.service, group.r1),
            ]),
          ),
        );
      });
    this.groupedSource = new GroupedDataSource<Priority>(
      {
        groupBy: (item) => String(item.r1),
        labelFn: (key, count) => `R1: ${key} (${count})`,
      },
      (page, pageSize) => {
        return this.service.getPriorityList({
          page,
          pageSize,
          sort: this.sortColumn() ?? undefined,
          sortDirection: (this.sortDirection() as 'asc' | 'desc') ?? undefined,
        });
      },
    );

    this.groupedSource.loading
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => this.isLoading.set(loading));
  }
  toggleExpand(r1: number | null, viewport: CdkVirtualScrollViewport): void {
    // const key = String(r1);
    // const expanded = this.groupExpanded()[key] ?? false;
    // this.groupExpanded.update((prev) => ({ ...prev, [key]: !expanded }));

    // this.groupExpanded()[group.r1 ?? -1] = !this.groupExpanded()[group.r1 ?? -1];
    this.groupExpanded.update((prev) => ({ ...prev, [r1 ?? -1]: !(prev[r1 ?? -1] ?? false) }));
    // After toggling the group, we need to manually trigger the viewport to check the new range and fetch data if needed
    //viewport.scrollToIndex(0); // Scroll to top to trigger data fetch for the newly expanded group
    viewport.checkViewportSize(); // Check if the viewport needs to fetch more data based on the new expanded state
    //this.priorityDataSources()[String(r1)]?.refresh(); // Refresh the data source for the group to fetch data if it's expanded
    // Looks like reinitialize fix the issue it become empty after toggle
    this.priorityDataSources.update((prev) => {
      const key = String(r1);
      // const ds = prev[key];
      // if (ds) {
      //   ds.refresh();
      // }
      prev[key] = new PriorityListDataSource(this.service, r1);
      return { ...prev };
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.groupedSource?.disconnect();
  }

  onGroupToggle(key: string): void {
    this.groupedSource.toggleGroup(key);
  }

  dropColumn(event: CdkDragDrop<ColumnDef[]>) {
    const columns = this.columns();
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this.columns.set(columns.splice(0)); // Trigger change detection
  }

  gridActive() {
    console.log('Grid active');
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
        this.groupedSource.refresh();
        this.viewport?.scrollToIndex(0);
        return;
      }
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }

    this.groupedSource.refresh();
    this.viewport?.scrollToIndex(0);
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

  onCellInput(event: string, rowIndex: number, colKey: keyof Priority): void {
    console.log('Input event:', {
      rowIndex,
      colKey,
      event,
    });
  }
}
