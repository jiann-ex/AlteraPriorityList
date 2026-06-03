import {
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Priority, PriorityGroup } from '../../types/priority';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { Filter, PriorityListService } from '../../services/priority-list.service';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import type { ColumnDef } from '../../types/column-def';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { PriorityData, SortDirection } from '@app-types';
import { FilterState, PriorityListTh } from '../priority-list-th/priority-list-th';
import { createColumnWidths } from '../priority-list-th';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { GridTableImports } from '../grid-table/grid-table';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleChevronDown, lucideCircleChevronRight, lucideBox } from '@ng-icons/lucide';
import { PriorityListDataSource } from '../../services/priority-list-datasource';
import { AsyncPipe, NgClass } from '@angular/common';
import { columns } from './priority-list-columns';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { CdkObserveContent } from '@angular/cdk/observers';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';

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
    HlmDialogImports,
    HlmEmptyImports,
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
      lucideBox,
    }),
  ],
})
export class PriorityList implements OnInit, OnDestroy {
  private readonly service = inject(PriorityListService);
  private readonly destroy$ = new Subject<void>();

  /** Undo stack to track all edits for Ctrl+Z */
  private readonly undoStack: {
    dataSource: PriorityListDataSource;
    index: number;
    data: Priority;
    field: keyof Priority;
    previousValue: unknown;
  }[] = [];

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      this.undo();
    }
  }

  isLoading = signal(false);
  isSaving = signal(false);
  totalCount = signal(0);
  priorityGrouped = signal<PriorityGroup[]>([]);
  totalEdited = computed(() =>
    this.priorityGrouped().reduce((sum, group) => sum + group.dataSource.totalEdited(), 0),
  );
  editedItems = computed(() =>
    this.priorityGrouped().flatMap((group) => group.dataSource.editedItems()),
  );

  groupExpanded = signal<Record<string, boolean>>({});

  sortColumn = signal<string | null>(null);
  sortDirection = signal<SortDirection>(null);

  testToggleTable = signal(false);

  filters = signal<Filter[]>([]);

  protected readonly columns = signal<ColumnDef[]>(columns);

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
  private _loadPriorityGroups(): void {
    this.isLoading.set(true);
    this.service
      .getPriorityGroups()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((res) => {
        this.priorityGrouped.set(res);
        combineLatest(this.priorityGrouped().map((group) => group.dataSource.totalCount$))
          .pipe(takeUntil(this.destroy$))
          .subscribe((counts) => {
            const total = counts.reduce((sum, count) => sum + count, 0);
            this.totalCount.set(total);
            // Update each group's total count in priorityGrouped signal
            for (let i = 0; i < counts.length; i++) {
              this.priorityGrouped.update((groups) => {
                const newGroups = [...groups];
                newGroups[i] = new PriorityGroup(groups[i].r1, counts[i], groups[i].dataSource);
                return newGroups;
              });
            }
          });
      });
  }

  ngOnInit(): void {
    this._loadPriorityGroups();
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
    } else {
      //group.dataSource.refresh();
    }
  }
  printDataSource(e: any): void {
    //console.log(e);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    //this.priorityGrouped().forEach((group) => group.dataSource.disconnect());
  }

  dropColumn(event: CdkDragDrop<ColumnDef[]>) {
    const columns = this.columns();
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this.columns.set(columns.splice(0)); // Trigger change detection
  }

  gridActive() {
    console.log('Grid active');
  }

  onSort(column: string, direction: SortDirection, isToggled: boolean): void {
    if (!isToggled) {
      if (!direction) {
        this.sortColumn.set(null);
      } else {
        this.sortColumn.set(column);
      }
      this.sortDirection.set(direction);
    } else {
      if (this.sortColumn() === column) {
        // Cycle: asc -> desc -> none
        const current = this.sortDirection();
        if (current === 'asc') {
          this.sortDirection.set('desc');
        } else if (current === 'desc') {
          this.sortColumn.set(null);
          this.sortDirection.set(null);
        }
      } else {
        this.sortColumn.set(column);
        this.sortDirection.set('asc');
      }
    }

    this.priorityGrouped().forEach((group) => {
      group.dataSource.sort(this.sortColumn(), this.sortDirection());
    });
  }

  onFilter(key: keyof Priority, e: FilterState): void {
    if (!e) {
      this.filters.update((prev) => prev.filter((f) => f.key !== key));
    } else {
      const newFilter: Filter = {
        key,
        term: e.searchTerm,
        values: e.selected,
        includeBlank: e.includeBlank,
      };
      this.filters.update((prev) => {
        const others = prev.filter((f) => f.key !== key);
        return [...others, newFilter];
      });
    }

    this.priorityGrouped().forEach((group) => {
      group.dataSource.filter(this.filters());
    });
  }

  private _getExpandedGroups(): PriorityGroup[] {
    return this.priorityGrouped().filter((group) => this.groupExpanded()[group.key]);
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
    const previousValue = data[field];
    const parsed = parseInt(value);
    if (isNaN(parsed)) {
      dataSource.editItem(index, data, field, null);
    } else {
      dataSource.editItem(index, data, field, parsed);
    }
    this.undoStack.push({ dataSource, index, data, field, previousValue });
  }
  editStringitem(
    dataSource: PriorityListDataSource,
    index: number,
    data: PriorityData,
    field: keyof Priority,
    value: string,
  ): void {
    if (!data) return;
    const previousValue = data[field];
    const parsed = String(value);
    dataSource.editItem(index, data, field, parsed);
    this.undoStack.push({ dataSource, index, data, field, previousValue });
  }
  editBooleanItem(
    dataSource: PriorityListDataSource,
    index: number,
    data: PriorityData,
    field: keyof Priority,
    value: boolean,
  ): void {
    if (!data) return;
    const previousValue = data[field];
    const parsed = Boolean(value);
    dataSource.editItem(index, data, field, parsed);
    this.undoStack.push({ dataSource, index, data, field, previousValue });
  }

  undo(): void {
    const entry = this.undoStack.pop();
    if (!entry) return;
    entry.dataSource.undoEdit(entry.index, entry.data, entry.field, entry.previousValue);
  }

  /** Find the data source and index for a given edited item by id */
  private findDataSourceForItem(item: PriorityData): {
    dataSource: PriorityListDataSource;
    index: number;
  } | null {
    if (!item) return null;
    for (const group of this.priorityGrouped()) {
      const index = group.dataSource.findIndexById(item.id);
      if (index !== -1) {
        return { dataSource: group.dataSource, index };
      }
    }
    return null;
  }

  /** Edit a number field from the dialog */
  editDialogNumberItem(row: PriorityData, field: keyof Priority, value: string): void {
    if (!row) return;
    const result = this.findDataSourceForItem(row);
    if (!result) return;
    const { dataSource, index } = result;
    const previousValue = row[field];
    const parsed = parseInt(value);
    if (isNaN(parsed)) {
      dataSource.editItem(index, row, field, null);
    } else {
      dataSource.editItem(index, row, field, parsed);
    }
    this.undoStack.push({ dataSource, index, data: row, field, previousValue });
  }
  editDialogStringItem(row: PriorityData, field: keyof Priority, value: string): void {
    if (!row) return;
    const result = this.findDataSourceForItem(row);
    if (!result) return;
    const { dataSource, index } = result;
    const previousValue = row[field];
    const parsed = String(value);
    dataSource.editItem(index, row, field, parsed);
    this.undoStack.push({ dataSource, index, data: row, field, previousValue });
  }

  /** Edit a boolean field from the dialog */
  editDialogBooleanItem(row: PriorityData, field: keyof Priority, value: boolean): void {
    if (!row) return;
    const result = this.findDataSourceForItem(row);
    if (!result) return;
    const { dataSource, index } = result;
    const previousValue = row[field];
    dataSource.editItem(index, row, field, Boolean(value));
    this.undoStack.push({ dataSource, index, data: row, field, previousValue });
  }

  /**
   * To update the x scroll position of virtual scroll viewports, to makesure the vertical scrollbar always display at the right side
   * Without affects by the parent container horizontal scroll
   */
  onGridScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const scrollLeft = el.scrollLeft;
    const wrappers = el.querySelectorAll<HTMLElement>(
      ':scope > cdk-virtual-scroll-viewport .cdk-virtual-scroll-content-wrapper',
    );
    wrappers.forEach((wrapper) => {
      wrapper.style.left = `${-scrollLeft}px`;
    });
  }

  saveChanges(): void {
    const edited = this.editedItems();
    if (edited.length === 0) {
      toast.info('No changes to save');
      return;
    }
    this.isSaving.set(true);
    this.service
      .saveChanges(edited)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSaving.set(false);
        }),
      )
      .subscribe(() => {
        toast.success('Changes saved successfully');
        // Clear undo stack after successful save
        this.undoStack.length = 0;
        // Reload data after successful save
        this._loadPriorityGroups();
      });
  }
}
