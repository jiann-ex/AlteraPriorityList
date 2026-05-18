import { Grid, GridCell, GridCellWidget, GridRow } from '@angular/aria/grid';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { isPlatformServer } from '@angular/common';
import {
  AfterViewInit,
  booleanAttribute,
  Component,
  computed,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { classes } from '@spartan-ng/helm/utils';
import { Subscription } from 'rxjs';

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
  hostDirectives: [
    {
      directive: Grid,
      inputs: ['enableSelection: enableSelection'],
    },
  ],
})
export class GridTable {
  //private readonly _grid = inject(Grid, { self: true });

  constructor() {
    classes(() => 'grid w-full caption-bottom text-sm');
    //console.log('GridTable initialized with grid instance:', this._grid.);
  }
}

@Directive({
  selector: '[gridTableHeader]',
  host: {
    role: 'rowgroup',
    'data-slot': 'grid-table-header',
    '[class]': 'stickyClasses()',
    '[style.top.px]': 'inverseOfTranslation()',
  },
})
export class GridTableHeader implements OnDestroy {
  // Try get cdk virtual scroll viewport from parent, if exists then we are in virtual scroll mode
  private readonly viewport = inject(CdkVirtualScrollViewport, { optional: true });

  readonly sticky = input(false, { transform: booleanAttribute });
  protected readonly stickyClasses = computed(() => (this.sticky() ? 'sticky top-0 z-10' : ''));
  protected readonly inverseOfTranslation = signal<number>(0);
  private _scrollIndexChangeSubscription: Subscription | null = null;

  constructor() {
    classes(() => 'grid grid-cols-subgrid col-span-full border-b bg-background');

    effect(() => {
      // Check sticky and handle inverse of translation calculation to keep the sticky header in place when virtual scrolling
      // Also keep watching sticky state and to unsubscribe from scroll changes when sticky is turned off to prevent unnecessary calculations
      if (this.viewport && this.sticky()) {
        this._scrollIndexChangeSubscription = this.viewport.scrolledIndexChange.subscribe(() =>
          this.calculateInverseOfTranslation(),
        );
      } else {
        this._scrollIndexChangeSubscription?.unsubscribe();
        this._scrollIndexChangeSubscription = null;
        this.inverseOfTranslation.set(0);
      }
    });
  }

  ngOnDestroy(): void {
    this._scrollIndexChangeSubscription?.unsubscribe();
    this._scrollIndexChangeSubscription = null;
  }

  private calculateInverseOfTranslation(): void {
    if (!this.viewport) {
      this.inverseOfTranslation.set(0);
      return;
    }
    const offset = this.viewport.getOffsetToRenderedContentStart();
    this.inverseOfTranslation.set(-(offset ?? 0));
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

    if (!wrapper) {
      this.initSyncColumnsToWrapper(hostEl); // fallback to host if wrapper not found
      return;
    }

    // if (this.el.nativeElement.tagName === 'CDK-VIRTUAL-SCROLL-VIEWPORT') {
    //   this.el.nativeElement.style['overflow-x'] = 'hidden'; // prevent double scrollbars
    //   this.el.nativeElement.style['scrollbar-gutter'] = 'stable';
    // }
    // wrapper.style.overflowX = 'hidden'; // prevent double scrollbars

    this.initSyncColumnsToWrapper(wrapper);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private initSyncColumnsToWrapper(wrapper: HTMLElement): void {
    // Apply grid layout to the content wrapper
    this.syncColumnsToWrapper(wrapper);

    // Watch for style changes on the grid parent (e.g. dynamic column resize)
    const gridParent = this.el.nativeElement.closest(
      '[data-slot="grid-table"]',
    ) as HTMLElement | null;
    if (gridParent) {
      this.observer = new MutationObserver(() => this.syncColumnsToWrapper(wrapper));
      this.observer.observe(gridParent, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
  }
  /** Find the closest grid table parent element, make sure they are the same width align with the header widths */
  private syncColumnsToWrapper(wrapper: HTMLElement): void {
    const hostEl: HTMLElement = this.el.nativeElement;
    const gridParent = hostEl.closest('[data-slot="grid-table"]') as HTMLElement | null;
    if (!gridParent) {
      console.error(
        'Grid Table not found for GridTableBody, please make sure to use GridTableBody inside a GridTable',
      );
      return;
    }

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
  hostDirectives: [GridRow],
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
  selector: '[gridTableGroupRow]',
  host: {
    role: 'row',
    'data-slot': 'grid-table-group-row',
    '[attr.aria-expanded]': 'expanded()',
    '(click)': 'toggle()',
    '(keydown.enter)': 'toggle()',
    '(keydown.space)': 'toggle(); $event.preventDefault()',
    tabindex: '0',
    '[class]': 'stickyClasses()',
    '[style.top.px]': 'inverseOfTranslation()',
  },
  hostDirectives: [GridRow],
})
export class GridTableGroupRow {
  /** Try get cdk virtual scroll viewport from parent, if exists then we are in virtual scroll mode */
  private readonly _viewport = inject(CdkVirtualScrollViewport, { optional: true });
  readonly expanded = model<boolean>(true);
  readonly toggled = output<boolean>();
  readonly sticky = input(false, { transform: booleanAttribute });
  protected readonly stickyClasses = computed(() => (this.sticky() ? 'sticky top-0 z-10' : ''));
  protected readonly inverseOfTranslation = signal<number>(0);
  private _scrollIndexChangeSubscription: Subscription | null = null;

  constructor() {
    classes(
      () =>
        'grid grid-cols-subgrid col-span-full border-b transition-colors bg-muted/30 hover:bg-muted/50 cursor-pointer select-none font-medium',
    );

    effect(() => {
      // Check sticky and handle inverse of translation calculation to keep the sticky header in place when virtual scrolling
      // Also keep watching sticky state and to unsubscribe from scroll changes when sticky is turned off to prevent unnecessary calculations
      if (this._viewport && this.sticky()) {
        this._scrollIndexChangeSubscription = this._viewport.scrolledIndexChange.subscribe(() =>
          this.calculateInverseOfTranslation(),
        );
      } else {
        this._scrollIndexChangeSubscription?.unsubscribe();
        this._scrollIndexChangeSubscription = null;
        this.inverseOfTranslation.set(0);
      }
    });
  }

  toggle(): void {
    const next = !this.expanded();
    this.expanded.set(next);
    this.toggled.emit(next);
  }

  private calculateInverseOfTranslation(): void {
    if (!this._viewport) {
      this.inverseOfTranslation.set(0);
      return;
    }
    const offset = this._viewport.getOffsetToRenderedContentStart();
    this.inverseOfTranslation.set(-(offset ?? 0));
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
  hostDirectives: [
    {
      directive: GridCell,
      inputs: [
        'rowIndex: rowIndex',
        'colIndex: colIndex',
        'selectable: selectable',
        'selected: selected',
        'disabled: disabled',
      ],
      //outputs: ['selectedChange: selectedChange'],
    },
  ],
})
export class GridTableCell {
  private readonly _gridCell = inject(GridCell, { self: true });
  readonly activated = output<void>();
  readonly deactivated = output<void>();

  constructor() {
    classes(
      () =>
        'p-2 whitespace-nowrap [&:has([role=checkbox])]:pe-0 hover:bg-muted text-nowrap text-ellipsis overflow-hidden ' +
        'data-[active=true]:bg-muted data-[active=true]:outline data-[active=true]:outline-2 data-[active=true]:outline-offset-[-2px] data-[active=true]:outline-primary/50',
    );
    this._gridCell.active;
    effect(() => {
      if (this._gridCell.active()) {
        this.activated.emit();
      } else {
        this.deactivated.emit();
      }
    });
  }
}

/**
 *
 */
@Directive({
  selector: '[gridTableCellInput]',
  host: {
    contenteditable: '',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GridTableCellInput),
      multi: true,
    },
  ],
})
export class GridTableCellInput
  extends GridTableCell
  implements ControlValueAccessor, OnInit, OnDestroy
{
  private readonly _value = signal<string | null>(null);
  private readonly _el = inject(ElementRef);
  private onTouchedFn: () => void = () => {};
  private onChangeFn: (value: string) => void = () => {};

  constructor() {
    super();
  }
  writeValue(obj: string): void {
    // Check if obj is string, if not set to empty string
    if ((obj && typeof obj !== 'string') || !obj) {
      obj = '';
    } else {
      this._value.set(obj);
    }

    this._el.nativeElement.textContent = this._value();
  }
  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    // @TODO: implement disabled state if needed
  }

  ngOnInit(): void {
    this._el.nativeElement.textContent = this._value();

    this._el.nativeElement.addEventListener('input', this.onInput.bind(this));
    this._el.nativeElement.addEventListener('blur', this.onBlur.bind(this));
  }
  ngOnDestroy(): void {
    this._el.nativeElement.removeEventListener('input', this.onInput.bind(this));
    this._el.nativeElement.removeEventListener('blur', this.onBlur.bind(this));
  }

  private onInput(event: Event): void {
    const text = (event.target as HTMLElement).textContent ?? '';
    this._value.set(text);
    this.onChangeFn(text);
  }

  private onBlur(): void {
    this.onTouchedFn();
  }
}

/** Allow to press enter to toggle boolean values */
@Component({
  selector: '[gridTableCellCheckbox]',
  template: `
    @if (this._value()) {
      <span class="text-green-500">✓</span>
    } @else {
      <span class="text-red-500">✗</span>
    }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GridTableCellCheckbox),
      multi: true,
    },
  ],
})
export class GridTableCellCheckbox
  extends GridTableCell
  implements ControlValueAccessor, OnInit, OnDestroy
{
  protected readonly _value = signal<boolean>(false);
  private readonly _el = inject(ElementRef);
  private onTouchedFn: () => void = () => {};
  private onChangeFn: (value: boolean) => void = () => {};

  constructor() {
    super();
  }
  writeValue(obj: boolean): void {
    // Check if obj is boolean, if not set to false
    if (typeof obj !== 'boolean') {
      obj = false;
    }
    this._value.set(obj);
  }
  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    // @TODO: implement disabled state if needed
  }

  ngOnInit(): void {
    this._el.nativeElement.addEventListener('keydown', this.onKeyDown.bind(this));
    this._el.nativeElement.addEventListener('blur', this.onBlur.bind(this));
  }
  ngOnDestroy(): void {
    this._el.nativeElement.removeEventListener('keydown', this.onKeyDown.bind(this));
    this._el.nativeElement.removeEventListener('blur', this.onBlur.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    console.log('Checkbox keydown:', event.key);
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const newValue = !this._value();
    this._value.set(newValue);
    this.onChangeFn(newValue);
  }
  private onBlur(): void {
    console.log('Checkbox blur, marking as touched');
    this.onTouchedFn();
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
  GridTableGroupRow,
  GridTableHead,
  GridTableCell,
  GridTableCellInput,
  GridTableCellCheckbox,
  GridTableCaption,
] as const;
