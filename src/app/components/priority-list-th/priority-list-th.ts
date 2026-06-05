import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  OnInit,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { ColumnDef } from '../../types/column-def';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideCheckCheck,
  lucideFilterX,
  lucideSortAsc,
  lucideSortDesc,
  lucideTrash,
} from '@ng-icons/lucide';
import { NullableString, priorityToMaps, SortDirection } from '@app-types';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDropdownMenuImports, HlmDropdownMenuTrigger } from '@spartan-ng/helm/dropdown-menu';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import {
  INIT_OPTION_SIZE,
  PriorityFilterOptionsDataSource,
} from '../../services/priority-filter-options-datasource';
import { PriorityListService } from '../../services/priority-list.service';
import { CdkFixedSizeVirtualScroll, ScrollingModule } from '@angular/cdk/scrolling';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, NgClass } from '@angular/common';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';

export type FilterState = {
  includeBlank: boolean;
  searchTerm: string | null;
  selected: string[];
} | null;

@Component({
  selector: '[appPriorityListTh], [appPriorityListCol]',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmDropdownMenuImports,
    HlmSkeletonImports,
    CdkFixedSizeVirtualScroll,
    ScrollingModule,
    HlmInputImports,
    FormsModule,
    AsyncPipe,
    HlmEmptyImports,
    NgClass,
  ],
  templateUrl: './priority-list-th.html',
  viewProviders: [
    provideIcons({
      lucideSortAsc,
      lucideSortDesc,
      lucideTrash,
      lucideFilterX,
      lucideCheckCheck,
      lucideX,
    }),
  ],
  host: {
    class: 'relative cursor-pointer select-none',
  },
  hostDirectives: [
    {
      directive: HlmDropdownMenuTrigger,
    },
  ],
})
export class PriorityListTh implements OnInit {
  /**
   * With required, this will make sure the template can be access ngOnInit lifecycle,
   * so we can set it to dropdown menu trigger, if not required then the template will be undefined in ngOnInit and we cant set it to dropdown menu trigger
   */
  private readonly _menu = viewChild.required<TemplateRef<unknown>>('menu');

  column = input.required<ColumnDef>();
  /** Emit when the sort direction changes */
  sort = output<{ sortDirection: SortDirection; isToggled: boolean }>();
  /** Required to know is this column currently being sort */
  sortColumn = input.required<string | null>();
  /**
   * When null, just clear the filter,
   * when string is provided, it means filter with the term,
   * when includeBlank is true, it means include blank value in the filter result
   */
  filter = output<FilterState>();
  /** Required to know the the current column is sorted then need to know its direction */
  sortDirection = input.required<SortDirection>();
  widths = input<Record<string, number>>({});
  widthChange = output<number>();
  searchTerm = signal<string | null>(null);
  blank = signal(false);
  /** True only once a filter has been applied (via Apply), used to show the clear-filter button */
  protected readonly hasActiveFilter = signal(false);
  /** When true, the filter only allows free-text search instead of selectable options */
  protected readonly isSearchOnly = computed(() => this.column().searchOnly ?? false);

  private readonly _dropdownMenuHost: HlmDropdownMenuTrigger = inject(HlmDropdownMenuTrigger, {
    host: true,
  });
  private readonly _el = inject(ElementRef<HTMLElement>);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly priorityListService = inject(PriorityListService);
  protected dataSource!: PriorityFilterOptionsDataSource;
  private readonly _totalItemCount = signal(INIT_OPTION_SIZE);
  protected readonly viewportHeight = computed(() => Math.min(256, this._totalItemCount() * 32));

  constructor() {}

  ngOnInit(): void {
    this._dropdownMenuHost.setMenuTemplate(this._menu());
    this._dropdownMenuHost.opened.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
      //this.scrollTop.set(0);
    });

    // Search-only columns filter by free-text term and don't load selectable options
    if (this.isSearchOnly()) {
      return;
    }

    this.dataSource = new PriorityFilterOptionsDataSource(
      this.priorityListService,
      priorityToMaps.get(this.column().key)!,
    );
    this.dataSource.totalCount$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((count) => this._totalItemCount.set(count));
  }

  protected options = signal<NullableString[]>(
    Array.from({ length: 100000 }, (_, i) =>
      i > 10000 ? `Option123234123321 312441233412 ${i + 1}` : `Option ${i + 1}`,
    ),
  );
  protected selectedOptions = signal<Set<string>>(new Set());

  protected toggleOption(option: string): void {
    const selected = this.selectedOptions();
    if (selected.has(option)) {
      selected.delete(option);
    } else {
      selected.add(option);
    }
    this.selectedOptions.set(new Set(selected));
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = this._el.nativeElement.getBoundingClientRect().width;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (e.clientX - startX));
      this.widthChange.emit(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // When resize end, it register a click causing the dropdown menu to open,
      // so we need to close it programmatically
      // visually should not have any dropdown appear after resized
      setTimeout(() => {
        this._dropdownMenuHost.close(); // Close the menu when resizing ends
      });
    };
    // Change the cursor to prevent mouse flicketing between col-resize and default when resizing
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    this._destroyRef.onDestroy(() => onMouseUp());
  }

  private _searchTimeout: ReturnType<typeof setTimeout> | null = null;

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    // For search-only columns there is no option list to filter,
    // the term itself is applied as the filter on Apply.
    if (this.isSearchOnly()) {
      return;
    }
    // Debounce the search input to avoid too many requests
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
    }
    this._searchTimeout = setTimeout(() => {
      this.dataSource.search(value);
    }, 300);
  }

  toggleBlank(): void {
    this.blank.update((v) => !v);
  }
  clearSelect(): void {
    this.selectedOptions.set(new Set());
    this.applyFilter();
  }

  toggleSort(event: MouseEvent): void {
    event.stopPropagation(); // Prevent the dropdown menu from opening
    this.sort.emit({ sortDirection: null, isToggled: true });
  }
  manualSort(direction: SortDirection): void {
    this.sort.emit({ sortDirection: direction, isToggled: false });
  }

  applyFilter(): void {
    if (!this.searchTerm() && !this.blank() && this.selectedOptions().size === 0) {
      this.clearFilter();
      return;
    }

    this.hasActiveFilter.set(true);
    this.filter.emit({
      includeBlank: this.blank(),
      searchTerm: this.searchTerm(),
      selected: Array.from(this.selectedOptions()),
    });
  }

  clearFilter(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.resetFilterState();
    this.filter.emit(null);
  }

  /**
   * Reset this column's filter UI (search term, blank toggle, selected options)
   * without emitting. Used by the menu's "Clear all filters" so the parent can
   * re-apply the cleared filter/sort to every group's data source just once.
   */
  resetFilterState(): void {
    this.blank.set(false);
    this.searchTerm.set(null);
    this.selectedOptions.set(new Set());
    this.hasActiveFilter.set(false);
  }
}
