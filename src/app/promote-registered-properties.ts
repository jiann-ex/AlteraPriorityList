/**
 * Tailwind v4 registers internal custom properties (e.g. `--tw-border-style`,
 * `--tw-shadow`, ...) via `@property` at-rules, relying on their `initial-value`
 * to make utilities like `.border` work. Because these properties use
 * `inherits: false`, you cannot substitute the registration by declaring the
 * variables on `:host` — every element needs the registered initial value.
 *
 * The catch: `@property` rules ONLY register when they live in the document
 * tree. Rules defined inside a shadow root are ignored by the browser for
 * registration. When the app is built as a Shadow DOM web component (with no
 * global stylesheet), the `@property` rules ship inside the shadow root and
 * therefore never register — so `var(--tw-border-style)` resolves to nothing
 * and borders/shadows/etc. silently break.
 *
 * The fix is to copy just the `@property` declarations up into `document.head`
 * so they register globally. This leaks no visual styling into the host page —
 * `@property` only defines custom-property semantics (syntax / inheritance /
 * initial value). Registering a property after elements already exist triggers
 * a style recalc, so existing shadow-DOM elements pick up the initial values.
 */

const PROMOTED_STYLE_ID = 'tw-registered-properties';
let promoted = false;

export function promoteRegisteredProperties(
  shadowRoot: ShadowRoot,
  doc: Document = shadowRoot.ownerDocument ?? document,
): void {
  if (promoted || doc.getElementById(PROMOTED_STYLE_ID)) {
    promoted = true;
    return;
  }

  const seen = new Set<string>();
  const rules: string[] = [];

  const collect = (cssRules: CSSRuleList | undefined): void => {
    if (!cssRules) {
      return;
    }
    for (const rule of Array.from(cssRules)) {
      const text = rule.cssText;
      if (text.startsWith('@property')) {
        const name = text.slice('@property'.length).trim().split(/[\s{]/)[0];
        if (name && !seen.has(name)) {
          seen.add(name);
          rules.push(text);
        }
      } else if ('cssRules' in rule) {
        // Recurse into grouping rules (@layer, @media, @supports, ...)
        collect((rule as CSSGroupingRule).cssRules);
      }
    }
  };

  const readSheet = (sheet: CSSStyleSheet): void => {
    try {
      collect(sheet.cssRules);
    } catch {
      // Ignore sheets we cannot read (e.g. cross-origin or not yet parsed).
    }
  };

  shadowRoot.adoptedStyleSheets?.forEach(readSheet);
  shadowRoot.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.sheet) {
      readSheet(styleEl.sheet);
    }
  });

  if (!rules.length) {
    return;
  }

  const style = doc.createElement('style');
  style.id = PROMOTED_STYLE_ID;
  style.textContent = rules.join('\n');
  doc.head.appendChild(style);
  promoted = true;
}
