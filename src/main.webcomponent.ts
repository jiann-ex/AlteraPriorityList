import { createApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createCustomElement } from '@angular/elements';
import { provideShadowDomOverlayContainer } from './app/shadow-dom-overlay-container';

(async () => {
  const app = await createApplication({
    providers: [provideShadowDomOverlayContainer()],
  });
  const myElement = createCustomElement(App, { injector: app.injector });
  customElements.define('my-web-component', myElement);
})();
