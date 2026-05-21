import { Component, computed, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Priority, PriorityGroup } from '../../types/priority';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { PriorityListService } from '../../services/priority-list.service';
import { GroupedDataSource } from '../../services/grouped-datasource';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import type { ColumnDef } from '../../types/column-def';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { PriorityData, SortDirection } from '@app-types';
import { PriorityListTh } from '../priority-list-th/priority-list-th';
import { createColumnWidths } from '../priority-list-th';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { GridTableImports } from '../grid-table/grid-table';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleChevronDown, lucideCircleChevronRight } from '@ng-icons/lucide';
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
  /** @TODO: Remove this later, not in used anymore */
  @ViewChild('tableViewport') viewport?: CdkVirtualScrollViewport;

  private readonly service = inject(PriorityListService);
  private readonly destroy$ = new Subject<void>();

  /** @TODO: Remove this later, not in used anymore */
  groupedSource!: GroupedDataSource<Priority>;
  isLoading = signal(false);
  totalCount = signal(0);

  priorityGrouped = signal<PriorityGroup[]>([]);
  groupExpanded = signal<Record<string, boolean>>({});

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
  toggleExpand(group: PriorityGroup, viewport: CdkVirtualScrollViewport): void {
    // const key = String(r1);
    // const expanded = this.groupExpanded()[key] ?? false;
    // this.groupExpanded.update((prev) => ({ ...prev, [key]: !expanded }));

    // this.groupExpanded()[group.r1 ?? -1] = !this.groupExpanded()[group.r1 ?? -1];
    this.groupExpanded.update((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? false) }));
    const isNowExpanded = this.groupExpanded()[group.key];
    // After toggling the group, we need to manually trigger the viewport to check the new range and fetch data if needed
    //viewport.scrollToIndex(0); // Scroll to top to trigger data fetch for the newly expanded group
    viewport.checkViewportSize(); // Check if the viewport needs to fetch more data based on the new expanded state
    viewport.scrollToIndex(0); // Scroll to top to trigger data fetch for the newly expanded group
    //this.priorityDataSources()[String(r1)]?.refresh(); // Refresh the data source for the group to fetch data if it's expanded
    // Looks like reinitialize fix the issue it become empty after toggle
    // this.priorityDataSources.update((prev) => {
    //   const key = String(r1);
    //   const ds = prev[key];
    //   if (ds) {
    //     ds.refresh();
    //   }
    //   //prev[key] = new PriorityListDataSource(this.service, r1);
    //   return { ...prev };
    // });

    if (!isNowExpanded) {
      group.dataSource.empty();
      console.log('Clear the data source');
    }
  }
  printDataSource(e: any): void {
    //console.log(e);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.groupedSource?.disconnect();
    this.priorityGrouped().forEach((group) => group.dataSource.disconnect());
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

  onCellInput(event: string, rowIndex: number, colKey: keyof Priority): void {
    console.log('Input event:', {
      rowIndex,
      colKey,
      event,
    });
    console.log(this.priorityGrouped());
  }

  /** For R1 and R2 column */
  editNumberItem(
    dataSource: PriorityListDataSource,
    index: number,
    data: PriorityData,
    field: keyof Priority,
    value: string,
  ): void {
    if (!data) return;
    const parsed = parseInt(value);
    if (isNaN(parsed)) {
      dataSource.editItem(index, data, field, null);
    } else {
      dataSource.editItem(index, data, field, parsed);
    }
  }
  editBooleanItem(
    dataSource: PriorityListDataSource,
    index: number,
    data: PriorityData,
    field: keyof Priority,
    value: boolean,
  ): void {
    if (!data) return;
    console.log('Boolean input event:', {
      rowIndex: index,
      colKey: field,
      event: value,
    });
    const parsed = Boolean(value);
    dataSource.editItem(index, data, field, parsed);
  }
}
