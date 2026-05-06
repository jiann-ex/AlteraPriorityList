import type { Priority } from './priority';

export interface ColumnDef {
  key: keyof Priority;
  label: string;
  class?: string;
  editable?: boolean;
}
