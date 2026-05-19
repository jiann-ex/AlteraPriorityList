import { Component, signal, ViewEncapsulation } from '@angular/core';
import { Overlay, OverlayContainer } from '@angular/cdk/overlay';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmMenubarImports } from '@spartan-ng/helm/menubar';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { PriorityList } from './components/priority-list/priority-list';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAArrowUp } from '@ng-icons/lucide';
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
  providers: [{ provide: OverlayContainer, useClass: ShadowDomOverlayContainer }, Overlay],
  viewProviders: [provideIcons({ lucideAArrowUp })],
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class App {
  protected readonly title = signal('AlteraPriorityList');

  toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const appRoot = document.querySelector('app-root');
    if (appRoot) {
      appRoot.classList.toggle('dark');
    }
  }
}
