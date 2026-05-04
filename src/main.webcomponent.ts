import { createApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createCustomElement } from '@angular/elements';

(async () => {
  const app = await createApplication({ providers: [] });
  const myElement = createCustomElement(App, { injector: app.injector });
  customElements.define('my-web-component', myElement);
})();
