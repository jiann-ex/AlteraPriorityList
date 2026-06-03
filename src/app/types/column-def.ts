import type { Priority } from './priority';

export interface ColumnDef {
  key: keyof Priority;
  label: string;
  class?: string;
  editable?: boolean;
  /**
   * When true, the column filter only allows free-text search input,
   * instead of choosing from a list of selectable options.
   */
  searchOnly?: boolean;
}
