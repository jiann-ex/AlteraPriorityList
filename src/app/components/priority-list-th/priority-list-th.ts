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
import { lucideFilterX, lucideSortAsc, lucideSortDesc, lucideTrash } from '@ng-icons/lucide';
import { SortDirection } from '@app-types';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports, HlmDropdownMenuTrigger } from '@spartan-ng/helm/dropdown-menu';

// Custom virtual scroll settings
const OPTION_HEIGHT = 32; // px per item
const VISIBLE_COUNT = 8; // items visible at once
const BUFFER = 3; // extra items above/below

@Component({
  selector: '[appPriorityListTh], [appPriorityListCol]',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports],
  templateUrl: './priority-list-th.html',
  viewProviders: [
    provideIcons({
      lucideSortAsc,
      lucideSortDesc,
      lucideTrash,
      lucideFilterX,
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
  sort = output<void>();
  /** Required to know is this column currently being sort */
  sortColumn = input.required<string | null>();
  /** Required to know the the current column is sorted then need to know its direction */
  sortDirection = input.required<SortDirection>();
  widths = input<Record<string, number>>({});
  widthChange = output<number>();

  private readonly _dropdownMenuHost: HlmDropdownMenuTrigger = inject(HlmDropdownMenuTrigger, {
    host: true,
  });
  private readonly _el = inject(ElementRef<HTMLElement>);
  private readonly _zone = inject(NgZone);
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {}

  ngOnInit(): void {
    this._dropdownMenuHost.setMenuTemplate(this._menu());
    this._dropdownMenuHost.opened.pipe().subscribe(() => {
      this.scrollTop.set(0);
    });
  }

  protected options = signal<string[]>(
    Array.from({ length: 100000 }, (_, i) =>
      i > 10000 ? `Option123234123321 312441233412 ${i + 1}` : `Option ${i + 1}`,
    ),
  );
  protected selectedOptions = signal<Set<string>>(new Set());

  // --- Lightweight virtual scroll for options, as we cant use multiple cdk virtual scroll viewport within a viewport ---
  protected readonly optionHeight = OPTION_HEIGHT;
  protected scrollTop = signal(0);

  protected readonly totalHeight = computed(() => this.options().length * OPTION_HEIGHT);
  protected readonly visibleOptions = computed(() => {
    const top = this.scrollTop();
    const startIdx = Math.max(0, Math.floor(top / OPTION_HEIGHT) - BUFFER);
    const endIdx = Math.min(this.options().length, startIdx + VISIBLE_COUNT + BUFFER * 2);
    return this.options()
      .slice(startIdx, endIdx)
      .map((option, i) => ({
        option,
        index: startIdx + i,
        offsetTop: (startIdx + i) * OPTION_HEIGHT,
      }));
  });

  onOptionsScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.scrollTop.set(target.scrollTop);
  }

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
}
