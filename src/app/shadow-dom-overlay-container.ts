import { Injectable, ElementRef, inject } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Platform } from '@angular/cdk/platform';
import { DOCUMENT } from '@angular/common';

/**
 * Custom OverlayContainer that attaches the CDK overlay container
 * inside the component's Shadow DOM rather than document.body.
 * This ensures overlays (dropdowns, menus, tooltips, etc.) inherit
 * the Shadow DOM styles (Tailwind, component CSS) and remain isolated
 * from the host page.
 */
@Injectable()
export class ShadowDomOverlayContainer extends OverlayContainer {
  private readonly elementRef = inject(ElementRef);

  protected override _createContainer(): void {
    const containerClass = 'cdk-overlay-container';
    const shadowRoot = this.elementRef.nativeElement.shadowRoot;

    if (shadowRoot) {
      // Reuse existing container if already present
      const existing = shadowRoot.querySelector(`.${containerClass}`);
      if (existing) {
        this._containerElement = existing as HTMLElement;
        return;
      }

      const container = document.createElement('div');
      container.classList.add(containerClass);
      shadowRoot.appendChild(container);
      this._containerElement = container;
    } else {
      // Fallback: standard behavior (document.body)
      super._createContainer();
    }
  }
}
