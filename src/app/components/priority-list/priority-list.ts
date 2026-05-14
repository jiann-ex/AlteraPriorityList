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
import { Priority } from '../../types/priority';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { PriorityListService } from '../../services/priority-list';
import {
  GroupedDataSource,
  FlatRow,
  GroupHeaderRow,
  DataRow,
} from '../../services/grouped-datasource';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import type { ColumnDef } from '../../types/column-def';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { SortDirection } from '@app-types';
import { PriorityListTh } from '../priority-list-th/priority-list-th';
import { createColumnWidths } from '../priority-list-th';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { GridTableImports } from '../grid-table/grid-table';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';

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
  ],
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

  groupedSource!: GroupedDataSource<Priority>;
  isLoading = signal(false);
  totalCount = signal(0);

  sortColumn = signal<string | null>(null);
  sortDirection = signal<SortDirection>(null);

  testToggleTable = signal(false);

  filters: Record<string, string> = {};

  readonly columns = signal<ColumnDef[]>([
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
    this.groupedSource = new GroupedDataSource<Priority>(
      {
        groupBy: (item) => String(item.r1),
        labelFn: (key, count) => `R1: ${key} (${count})`,
      },
      (page, pageSize) => {
        console.log('Fetching page', { page, pageSize });
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

  // --- Editable cell logic ---

  private readonly el = inject(ElementRef);

  /** Editable column keys for navigation ordering */
  private readonly editableKeys: Signal<(keyof Priority)[]> = computed(() =>
    this.columns()
      .filter((c) => c.editable)
      .map((c) => c.key),
  );

  /**
   * Handle keydown on a contenteditable cell.
   * Supports: Arrow keys (Up/Down/Left/Right), Tab/Shift+Tab, Enter (commit), Escape (revert).
   */
  onCellKeydown(event: KeyboardEvent, rowIndex: number, colKey: keyof Priority): void {
    const target = event.target as HTMLElement;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        target.blur(); // triggers onCellBlur -> save
        break;

      case 'Escape':
        event.preventDefault();
        // Revert content from grouped source
        const item = this.groupedSource.getItemAtFlatIndex(rowIndex);
        if (item) {
          target.textContent = String((item as any)[colKey] ?? '');
        }
        target.blur();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.focusCell(rowIndex - 1, colKey);
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.focusCell(rowIndex + 1, colKey);
        break;

      case 'ArrowLeft':
        event.preventDefault();
        {
          const prevCol = this.getAdjacentEditableCol(colKey, -1);
          if (prevCol) {
            this.focusCell(rowIndex, prevCol);
          } else {
            // Wrap to last editable col of previous row
            this.focusCell(rowIndex - 1, this.editableKeys()[this.editableKeys().length - 1]);
          }
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        {
          const nextCol = this.getAdjacentEditableCol(colKey, 1);
          if (nextCol) {
            this.focusCell(rowIndex, nextCol);
          } else {
            // Wrap to first editable col of next row
            this.focusCell(rowIndex + 1, this.editableKeys()[0]);
          }
        }
        break;

      case 'Tab':
        event.preventDefault();
        const direction = event.shiftKey ? -1 : 1;
        const adjacentCol = this.getAdjacentEditableCol(colKey, direction);
        if (adjacentCol) {
          this.focusCell(rowIndex, adjacentCol);
        } else {
          // Wrap to next/prev row
          const nextRow = rowIndex + direction;
          const wrapCol =
            direction > 0
              ? this.editableKeys()[0]
              : this.editableKeys()[this.editableKeys().length - 1];
          this.focusCell(nextRow, wrapCol);
        }
        break;
    }
  }

  /** Commit edited value on blur */
  onCellBlur(event: FocusEvent, rowIndex: number, colKey: keyof Priority): void {
    const target = event.target as HTMLElement;
    const text = (target.textContent ?? '').trim();
    const numValue = Number(text);

    if (isNaN(numValue)) {
      // Revert invalid input
      const item = this.groupedSource.getItemAtFlatIndex(rowIndex);
      if (item) target.textContent = String((item as any)[colKey] ?? '');
      return;
    }

    const item = this.groupedSource.getItemAtFlatIndex(rowIndex);
    if (!item || (item as any)[colKey] === numValue) return;

    // Optimistic local update
    this.groupedSource.updateItemAtFlatIndex(rowIndex, colKey, numValue);

    // Persist to backend
    this.service
      .updatePriority(item.id, colKey as 'r1' | 'r2', numValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => {
          // Revert on failure
          this.groupedSource.updateItemAtFlatIndex(rowIndex, colKey, (item as any)[colKey]);
          target.textContent = String((item as any)[colKey] ?? '');
        },
      });
  }

  /** Select all text on focus for easy overwrite */
  onCellFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  onCellInput(event: string, rowIndex: number, colKey: keyof Priority): void {
    console.log('Input event:', {
      rowIndex,
      colKey,
      event,
    });
  }

  /** Focus a specific editable cell by row index and column key */
  private focusCell(rowIndex: number, colKey: keyof Priority): void {
    const host: HTMLElement = this.el.nativeElement;
    const selector = `[data-row="${rowIndex}"][data-col="${colKey}"]`;
    const cell = host.querySelector<HTMLElement>(selector);
    if (cell) {
      cell.focus();
    }
  }

  private getAdjacentEditableCol(
    current: keyof Priority,
    direction: number,
  ): keyof Priority | null {
    const idx = this.editableKeys().indexOf(current);
    const next = idx + direction;
    return next >= 0 && next < this.editableKeys().length ? this.editableKeys()[next] : null;
  }
}
