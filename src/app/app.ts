import { Component, signal, ViewEncapsulation } from '@angular/core';
import { Overlay, OverlayContainer } from '@angular/cdk/overlay';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { PriorityList } from './components/priority-list/priority-list';
import { ShadowDomOverlayContainer } from './shadow-dom-overlay-container';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { PriorityListMenu } from './components/priority-list-menu/priority-list-menu';

@Component({
  selector: 'app-root',
  imports: [HlmButtonImports, PriorityList, HlmToasterImports, PriorityListMenu],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  providers: [{ provide: OverlayContainer, useClass: ShadowDomOverlayContainer }, Overlay],
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
