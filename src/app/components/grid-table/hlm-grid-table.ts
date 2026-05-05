import { Directive, input } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';

/**
 * Grid-based table using divs only (no HTML table elements).
 * Useful for virtual scrolling where table layout constraints are problematic.
 */

@Directive({
  selector: 'div[hlmGridTable]',
  host: {
    role: 'table',
    'data-slot': 'grid-table',
  },
})
export class HlmGridTable {
  constructor() {
    classes(() => 'grid w-full caption-bottom text-sm');
  }
}

@Directive({
  selector: 'div[hlmGridTableHeader]',
  host: {
    role: 'rowgroup',
    'data-slot': 'grid-table-header',
  },
})
export class HlmGridTableHeader {
  constructor() {
    classes(() => 'border-b bg-background');
  }
}

@Directive({
  selector: 'div[hlmGridTableBody]',
  host: {
    role: 'rowgroup',
    'data-slot': 'grid-table-body',
  },
})
export class HlmGridTableBody {
  constructor() {
    classes(() => '[&>[data-slot=grid-table-row]:last-child]:border-0');
  }
}

@Directive({
  selector: 'div[hlmGridTableFooter]',
  host: {
    role: 'rowgroup',
    'data-slot': 'grid-table-footer',
  },
})
export class HlmGridTableFooter {
  constructor() {
    classes(() => 'bg-muted/50 border-t font-medium');
  }
}

@Directive({
  selector: 'div[hlmGridTableRow]',
  host: {
    role: 'row',
    'data-slot': 'grid-table-row',
  },
})
export class HlmGridTableRow {
  constructor() {
    classes(
      () =>
        'grid grid-cols-subgrid col-span-full border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted has-aria-expanded:bg-muted/15',
    );
  }
}

@Directive({
  selector: 'div[hlmGridTableHead]',
  host: {
    role: 'columnheader',
    'data-slot': 'grid-table-head',
  },
})
export class HlmGridTableHead {
  constructor() {
    classes(
      () =>
        'text-foreground flex items-center h-10 px-2 text-start font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0 hover:bg-muted',
    );
  }
}

@Directive({
  selector: 'div[hlmGridTableCell]',
  host: {
    role: 'cell',
    'data-slot': 'grid-table-cell',
  },
})
export class HlmGridTableCell {
  constructor() {
    classes(
      () => 'flex items-center p-2 whitespace-nowrap [&:has([role=checkbox])]:pe-0 hover:bg-muted',
    );
  }
}

@Directive({
  selector: 'div[hlmGridTableCaption]',
  host: {
    role: 'caption',
    'data-slot': 'grid-table-caption',
  },
})
export class HlmGridTableCaption {
  constructor() {
    classes(() => 'text-muted-foreground mt-4 text-sm');
  }
}

export const HlmGridTableImports = [
  HlmGridTable,
  HlmGridTableHeader,
  HlmGridTableBody,
  HlmGridTableFooter,
  HlmGridTableRow,
  HlmGridTableHead,
  HlmGridTableCell,
  HlmGridTableCaption,
] as const;
