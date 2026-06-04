import { computed, effect, Injectable, signal } from '@angular/core';
import { columns as ALL_COLUMNS } from '../components/priority-list/priority-list-columns';
import { createColumnWidths } from '../components/priority-list-th/create-column-widths';
import type { ColumnDef } from '../types/column-def';

export type PriorityListMenuEvent = 'reload' | 'expandAll' | 'collapseAll';
export type EventCallback<T> = (event: PriorityListMenuEvent, payload?: T) => void;

/** LocalStorage key for the column visibility map */
const COLUMNS_STORAGE_KEY = 'PriorityListColumnsSaved';
/** LocalStorage key for the persisted column widths */
const COLUMN_WIDTHS_STORAGE_KEY = 'PriorityListColumnWidthsSaved';
/** LocalStorage key for the persisted column order (array of column keys) */
const COLUMN_ORDER_STORAGE_KEY = 'PriorityListColumnOrderSaved';
/** LocalStorage key for the persisted group expand/collapse state, keyed by group key */
const GROUP_EXPANDED_STORAGE_KEY = 'PriorityListGroupExpandedSaved';

/**
 * Meant to be used as a shared service for the priority list menu,
 * allowing components menu component to trigger some events to the priority list components
 */
@Injectable({
  providedIn: 'root',
})
export class PriorityListMenuService {
  private _listeners: EventCallback<any>[] = [];

  /** All available columns (full ordered list), restored from the saved order */
  readonly columns = signal<ColumnDef[]>(this._loadColumns());

  /**
   * Visibility map keyed by column key. A column is visible unless it is
   * explicitly set to `false`, so brand-new columns default to visible.
   */
  readonly columnVisibility = signal<Record<string, boolean>>(this._loadVisibility());

  /** Persisted column widths keyed by column key */
  readonly columnWidths = signal<Record<string, number>>(this._loadWidths());

  /** Persisted group expand/collapse state keyed by group key */
  readonly groupExpanded = signal<Record<string, boolean>>(this._loadGroupExpanded());

  /** Columns currently visible, preserving the original column order */
  readonly visibleColumns = computed(() =>
    this.columns().filter((c) => this.isColumnVisible(c.key)),
  );

  constructor() {
    // Persist any change to column visibility / widths / order so they survive a refresh
    effect(() => this._writeJson(COLUMNS_STORAGE_KEY, this.columnVisibility()));
    effect(() => this._writeJson(COLUMN_WIDTHS_STORAGE_KEY, this.columnWidths()));
    effect(() =>
      this._writeJson(
        COLUMN_ORDER_STORAGE_KEY,
        this.columns().map((c) => c.key),
      ),
    );
    effect(() => this._writeJson(GROUP_EXPANDED_STORAGE_KEY, this.groupExpanded()));
  }

  reload() {
    this._emitEvent('reload');
  }
  expandAll() {
    this._emitEvent('expandAll');
  }
  collapseAll() {
    this._emitEvent('collapseAll');
  }

  /** A column is visible unless explicitly hidden */
  isColumnVisible(key: string): boolean {
    return this.columnVisibility()[key] !== false;
  }

  /** Toggle whether a column should be displayed */
  toggleColumn(key: string): void {
    this.columnVisibility.update((prev) => ({ ...prev, [key]: !this.isColumnVisible(key) }));
  }

  /** Update the persisted width for a single column */
  setColumnWidth(key: string, width: number): void {
    this.columnWidths.update((prev) => ({ ...prev, [key]: width }));
  }

  /** Replace the column order (e.g. after a drag reorder); persisted to localStorage */
  setColumns(columns: ColumnDef[]): void {
    this.columns.set(columns);
  }

  /** A group is collapsed unless explicitly expanded */
  isGroupExpanded(key: string): boolean {
    return this.groupExpanded()[key] === true;
  }

  /** Toggle a group's expand/collapse state; persisted to localStorage */
  toggleGroupExpanded(key: string): void {
    this.groupExpanded.update((prev) => ({ ...prev, [key]: !this.isGroupExpanded(key) }));
  }

  private _loadColumns(): ColumnDef[] {
    const savedOrder = this._readJson<string[]>(COLUMN_ORDER_STORAGE_KEY);
    if (!savedOrder) return ALL_COLUMNS;

    const byKey = new Map<string, ColumnDef>(ALL_COLUMNS.map((c) => [c.key, c]));
    const ordered: ColumnDef[] = [];
    // Place known columns first, in the saved order
    for (const key of savedOrder) {
      const col = byKey.get(key);
      if (col) {
        ordered.push(col);
        byKey.delete(key);
      }
    }
    // Append any columns added since the order was saved, keeping their original order
    for (const col of ALL_COLUMNS) {
      if (byKey.has(col.key)) ordered.push(col);
    }
    return ordered;
  }

  private _loadVisibility(): Record<string, boolean> {
    return this._readJson<Record<string, boolean>>(COLUMNS_STORAGE_KEY) ?? {};
  }

  private _loadWidths(): Record<string, number> {
    const defaults = createColumnWidths(ALL_COLUMNS.map((c) => c.key));
    const stored = this._readJson<Record<string, number>>(COLUMN_WIDTHS_STORAGE_KEY);
    return { ...defaults, ...(stored ?? {}) };
  }

  private _loadGroupExpanded(): Record<string, boolean> {
    return this._readJson<Record<string, boolean>>(GROUP_EXPANDED_STORAGE_KEY) ?? {};
  }

  private _readJson<T>(key: string): T | null {
    // Guard for non-browser environments (SSR / prerender) where localStorage is absent
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private _writeJson(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write errors (e.g. storage full / disabled)
    }
  }

  private _emitEvent<T>(event: PriorityListMenuEvent, payload?: T) {
    this._listeners.forEach((listener) => listener(event, payload));
  }

  /** Add a listener for priority list menu events */
  registerListener<T>(callback: EventCallback<T>) {
    this._listeners.push(callback);
  }

  /** Must be called to remove a listener when a component is destroyed or something */
  deregisterListener<T>(callback: EventCallback<T>) {
    this._listeners = this._listeners.filter((listener) => listener !== callback);
  }
}
