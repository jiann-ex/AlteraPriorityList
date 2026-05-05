import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { isPlatformServer } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';

/**
 * Grid-based table using divs only (no HTML table elements).
 * Useful for virtual scrolling where table layout constraints are problematic.
 */

@Directive({
  selector: '[gridTable]',
  host: {
    role: 'table',
    'data-slot': 'grid-table',
  },
})
export class GridTable {
  constructor() {
    classes(() => 'grid w-full caption-bottom text-sm');
  }
}

@Directive({
  selector: '[gridTableHeader]',
  host: {
    role: 'rowgroup',
    'data-slot': 'grid-table-header',
  },
})
export class GridTableHeader {
  constructor() {
    classes(() => 'grid grid-cols-subgrid col-span-full border-b bg-background');
  }
}

/**
 * GridTableBody works in two modes:
 * 1. Standard: applies subgrid classes directly (no virtual scroll)
 * 2. Virtual scroll: copies the parent grid's column template onto the
 *    CDK content wrapper since it's absolutely positioned (subgrid can't
 *    propagate through position:absolute).
 */
@Directive({
  selector: '[gridTableBody]',
  host: {
    role: 'rowgroup',
    'data-slot': 'grid-table-body',
  },
})
export class GridTableBody implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly viewport = inject(CdkVirtualScrollViewport, { optional: true });
  private observer?: MutationObserver;
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    if (!this.viewport) {
      // Standard mode: subgrid
      classes(
        () =>
          'grid grid-cols-subgrid col-span-full [&>[data-slot=grid-table-row]:last-child]:border-0',
      );
    } else {
      // Virtual scroll mode: span parent grid, let content wrapper handle internal grid
      classes(() => 'col-span-full');
    }
  }

  ngAfterViewInit(): void {
    if (!this.viewport || isPlatformServer(this.platformId)) return;

    const hostEl: HTMLElement = this.el.nativeElement;
    const wrapper = hostEl.querySelector(
      '.cdk-virtual-scroll-content-wrapper',
    ) as HTMLElement | null;

    if (!wrapper) return;

    // Apply grid layout to the content wrapper
    this.syncColumnsToWrapper(wrapper);

    // Watch for style changes on the grid parent (e.g. dynamic column resize)
    const gridParent = hostEl.closest('[data-slot="grid-table"]') as HTMLElement | null;
    if (gridParent) {
      this.observer = new MutationObserver(() => this.syncColumnsToWrapper(wrapper));
      this.observer.observe(gridParent, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private syncColumnsToWrapper(wrapper: HTMLElement): void {
    const hostEl: HTMLElement = this.el.nativeElement;
    const gridParent = hostEl.closest('[data-slot="grid-table"]') as HTMLElement | null;
    if (!gridParent) return;

    // Prefer the inline style (set by Angular binding), fall back to computed
    const columns =
      gridParent.style.gridTemplateColumns || getComputedStyle(gridParent).gridTemplateColumns;

    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = columns;
  }
}

@Directive({
  selector: '[gridTableFooter]',
  host: {
    role: 'rowgroup',
    'data-slot': 'grid-table-footer',
  },
})
export class GridTableFooter {
  constructor() {
    classes(() => 'grid grid-cols-subgrid col-span-full bg-muted/50 border-t font-medium');
  }
}

@Directive({
  selector: '[gridTableRow]',
  host: {
    role: 'row',
    'data-slot': 'grid-table-row',
  },
})
export class GridTableRow {
  constructor() {
    classes(
      () =>
        'grid grid-cols-subgrid col-span-full border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted has-aria-expanded:bg-muted/15',
    );
  }
}

@Directive({
  selector: '[gridTableHead]',
  host: {
    role: 'columnheader',
    'data-slot': 'grid-table-head',
  },
})
export class GridTableHead {
  constructor() {
    classes(
      () =>
        'text-foreground flex items-center h-10 px-2 text-start font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0 hover:bg-muted',
    );
  }
}

@Directive({
  selector: '[gridTableCell]',
  host: {
    role: 'cell',
    'data-slot': 'grid-table-cell',
  },
})
export class GridTableCell {
  constructor() {
    classes(
      () =>
        'p-2 whitespace-nowrap [&:has([role=checkbox])]:pe-0 hover:bg-muted text-nowrap text-ellipsis overflow-hidden',
    );
  }
}

@Directive({
  selector: '[gridTableCaption]',
  host: {
    role: 'caption',
    'data-slot': 'grid-table-caption',
  },
})
export class GridTableCaption {
  constructor() {
    classes(() => 'text-muted-foreground mt-4 text-sm');
  }
}

export const GridTableImports = [
  GridTable,
  GridTableHeader,
  GridTableBody,
  GridTableFooter,
  GridTableRow,
  GridTableHead,
  GridTableCell,
  GridTableCaption,
] as const;
