import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmMenubarImports } from '@spartan-ng/helm/menubar';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { PriorityListService } from './services/priority-list';
import { PriorityList } from './components/priority-list/priority-list';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAArrowUp } from '@ng-icons/lucide';
import { Priority } from './types/priority';
import { ShadowDomOverlayContainer } from './shadow-dom-overlay-container';

@Component({
  selector: 'app-root',
  imports: [
    HlmButtonImports,
    HlmMenubarImports,
    HlmDropdownMenuImports,
    HlmTableImports,
    PriorityList,
    HlmSpinner,
    NgIcon,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  providers: [{ provide: OverlayContainer, useClass: ShadowDomOverlayContainer }],
  viewProviders: [provideIcons({ lucideAArrowUp })],
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class App {
  protected readonly title = signal('AlteraPriorityList');
  private readonly priorityListService = inject(PriorityListService);
  protected priorities = signal<Priority[]>([]);

  clicked() {
    console.log('Button clicked!', this.title());
    this.priorityListService.getPriorityList().subscribe((priorityList) => {
      console.log('Priority List:', priorityList);
      this.priorities.set(priorityList);
    });
  }
}
