<design_guidelines>
Colors:

* Primary accent: `#ff3a0d` — use for CTAs, highlights, active states, and key interactive elements.
* Dark base: `#213236` — use for backgrounds, navigation, and dark-mode surfaces.
* White: `#ffffff` — primary text on dark surfaces; light backgrounds in content areas.
* Never use raw color values inline — always reference a theme token (e.g., `theme.palette.primary.main`).

Typography:

* Font family: **Josefin Sans** — apply globally via MUI theme, never per-component.
* Section labels: uppercase, small, tracked (e.g., `letter-spacing: 0.1em`).
* Headings: bold weight, large scale — use MUI `h1`–`h4` variants, never arbitrary `font-size`.
* Body text: regular weight; keep line lengths readable (max ~70 characters).

Layout:

* Use MUI Grid for all layouts — no custom flexbox or grid CSS outside the theme.
* Use generous vertical spacing between sections (`py: 8` or higher at section level).

Components:

* Buttons: primary CTA uses `#ff3a0d` background with white text; no border-radius beyond `4px`.
* Cards: flat, minimal — no heavy shadows; use a subtle border or background shift for depth.
* Icons: line-style only; match stroke weight to body text size.

Mindset:

* Less is more — remove any element that does not serve a clear purpose.
* High contrast is mandatory — WCAG AA minimum for all text/background combinations.
* Consistency over creativity — deviate from the palette or type scale only with explicit justification.
  </design_guidelines>
