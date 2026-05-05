import {
  AfterViewInit,
  Component,
  input,
  output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ColumnDef } from '../../types/column-ref';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSortAsc, lucideSortDesc } from '@ng-icons/lucide';
import { SortDirection } from '@app-types';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports, HlmDropdownMenuTrigger } from '@spartan-ng/helm/dropdown-menu';
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'th[appPriorityListTh]',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports, ScrollingModule],
  templateUrl: './priority-list-th.html',
  viewProviders: [
    provideIcons({
      lucideSortAsc,
      lucideSortDesc,
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

  protected options = signal<string[]>(Array.from({ length: 500 }, (_, i) => `Option ${i + 1}`));
  protected selectedOptions = signal<Set<string>>(new Set());

  ngAfterViewInit(): void {
    //console.log('menu', this.menu);
    if (this.host && this.menu) {
      setTimeout(() => {
        this.host.setMenuTemplate(this.menu);
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
