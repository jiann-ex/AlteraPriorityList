import {
  Component,
  ElementRef,
  Host,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
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
import type { ColumnDef } from '../../types/column-ref';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { SortDirection } from '@app-types';
import { PriorityListTh } from '../priority-list-th/priority-list-th';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { GridTableImports } from '../grid-table/grid-table';

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
    { key: 'r1', label: 'R1', class: 'w-16 text-right', editable: true },
    { key: 'r2', label: 'R2', class: 'w-16 text-right', editable: true },
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

  inverseOfTranslation = signal<number>(0);
  /**
   * Calculate top offset to apply to sticky header cells to counteract the virtual scroll's translateY.
   * Apply negative number to sticky header to bring header back to the top
   * @returns
   */
  calculateInverseOfTranslation(): void {
    if (!this.viewport) {
      this.inverseOfTranslation.set(0);
      return;
    }
    const offset = this.viewport.getOffsetToRenderedContentStart();
    this.inverseOfTranslation.set(-(offset ?? 0));
  }

  dropColumn(event: CdkDragDrop<ColumnDef[]>) {
    console.log('Column drop event:', event);
    moveItemInArray(this.columns, event.previousIndex, event.currentIndex);
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

  // --- Editable cell logic ---

  private readonly el = inject(ElementRef);

  /** Editable column keys for navigation ordering */
  private readonly editableKeys: (keyof Priority)[] = this.columns
    .filter((c) => c.editable)
    .map((c) => c.key);

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
        // Revert content from dataSource
        const item = this.dataSource['data'].value[rowIndex];
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
            this.focusCell(rowIndex - 1, this.editableKeys[this.editableKeys.length - 1]);
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
            this.focusCell(rowIndex + 1, this.editableKeys[0]);
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
            direction > 0 ? this.editableKeys[0] : this.editableKeys[this.editableKeys.length - 1];
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
      const item = this.dataSource['data'].value[rowIndex];
      if (item) target.textContent = String((item as any)[colKey] ?? '');
      return;
    }

    const item = this.dataSource['data'].value[rowIndex];
    if (!item || (item as any)[colKey] === numValue) return;

    // Optimistic local update
    this.dataSource.updateItem(rowIndex, colKey, numValue);

    // Persist to backend
    this.service
      .updatePriority(item.id, colKey as 'r1' | 'r2', numValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => {
          // Revert on failure
          this.dataSource.updateItem(rowIndex, colKey, (item as any)[colKey]);
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
    const idx = this.editableKeys.indexOf(current);
    const next = idx + direction;
    return next >= 0 && next < this.editableKeys.length ? this.editableKeys[next] : null;
  }

  private isCaretAtStart(el: HTMLElement): boolean {
    const sel = window.getSelection();
    return !sel || sel.anchorOffset === 0;
  }

  private isCaretAtEnd(el: HTMLElement): boolean {
    const sel = window.getSelection();
    return !sel || sel.anchorOffset === (el.textContent?.length ?? 0);
  }
}
