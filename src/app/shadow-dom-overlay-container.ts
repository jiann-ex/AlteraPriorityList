import { Injectable, Provider } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';

/**
 * Host element selectors that own the application's shadow root.
 * `my-web-component` is the custom element used by the web-component build,
 * `app-root` is the host used by the regular bootstrap (dev / SSR-less build).
 */
const HOST_SELECTORS = ['my-web-component', 'app-root'];

/**
 * Custom OverlayContainer that attaches the CDK overlay container
 * inside the component's Shadow DOM rather than document.body.
 * This ensures overlays (dropdowns, menus, dialogs, tooltips, etc.) inherit
 * the Shadow DOM styles (Tailwind, component CSS) and remain isolated
 * from the host page.
 *
 * IMPORTANT: this must be provided at the ROOT injector (see
 * {@link provideShadowDomOverlayContainer}). Root-scoped services such as the
 * spartan/CDK `Dialog` resolve their `OverlayContainer` from the root injector,
 * so a component-level override would not apply to dialogs and they would leak
 * out to `document.body` unstyled. Because the root injector has no host
 * `ElementRef`, the shadow root is located by querying the DOM for the app host.
 */
@Injectable()
export class ShadowDomOverlayContainer extends OverlayContainer {
  // `_document` is inherited from the base OverlayContainer.

  protected override _createContainer(): void {
    const containerClass = 'cdk-overlay-container';
    const shadowRoot = this._findShadowRoot();

    if (shadowRoot) {
      // Reuse existing container if already present
      const existing = shadowRoot.querySelector(`.${containerClass}`);
      if (existing) {
        this._containerElement = existing as HTMLElement;
        return;
      }

      const container = this._document.createElement('div');
      container.classList.add(containerClass);
      shadowRoot.appendChild(container);
      this._containerElement = container;
    } else {
      // Fallback: standard behavior (document.body)
      super._createContainer();
    }
  }

  private _findShadowRoot(): ShadowRoot | null {
    for (const selector of HOST_SELECTORS) {
      const host = this._document.querySelector(selector);
      if (host?.shadowRoot) {
        return host.shadowRoot;
      }
    }
    return null;
  }
}

/**
 * Provides {@link ShadowDomOverlayContainer} as the application-wide
 * `OverlayContainer`. Register this in the ROOT providers (appConfig and the
 * web-component bootstrap) so every overlay — including root-scoped dialogs —
 * renders inside the shadow DOM.
 */
export function provideShadowDomOverlayContainer(): Provider {
  return { provide: OverlayContainer, useClass: ShadowDomOverlayContainer };
}
