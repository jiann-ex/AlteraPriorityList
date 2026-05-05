import {
  AfterViewInit,
  Component,
  computed,
  input,
  output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ColumnDef } from '../../types/column-ref';
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
    class: 'cursor-pointer select-none',
  },
  hostDirectives: [
    {
      directive: HlmDropdownMenuTrigger,
    },
  ],
})
export class PriorityListTh implements AfterViewInit {
  @ViewChild('menu') menu!: TemplateRef<unknown>;

  column = input.required<ColumnDef>();
  /** Emit when the sort direction changes */
  sort = output<void>();
  /** Required to know is this column currently being sort */
  sortColumn = input.required<string | null>();
  /** Required to know the the current column is sorted then need to know its direction */
  sortDirection = input.required<SortDirection>();

  constructor(private host: HlmDropdownMenuTrigger) {}

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

  ngAfterViewInit(): void {
    if (this.host && this.menu) {
      setTimeout(() => {
        this.host.setMenuTemplate(this.menu);
        this.host.opened.pipe().subscribe(() => {
          // reset scroll when menu opens
          this.scrollTop.set(0);
        });
      });
    }
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
}
