import { Component, signal, ViewEncapsulation } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { PriorityList } from './components/priority-list/priority-list';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { PriorityListMenu } from './components/priority-list-menu/priority-list-menu';

// NOTE: the OverlayContainer override now lives at the root injector
// (see provideShadowDomOverlayContainer in app.config.ts / main.webcomponent.ts)
// so that root-scoped dialogs also render inside the shadow DOM.
@Component({
  selector: 'app-root',
  imports: [HlmButtonImports, PriorityList, HlmToasterImports, PriorityListMenu],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
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
