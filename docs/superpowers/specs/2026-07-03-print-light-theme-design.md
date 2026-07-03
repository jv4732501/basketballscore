# Force Light Theme When Printing

## Problem

Printing the page (e.g. browser print / Ctrl+P) currently prints whatever theme is active on screen, including the dark theme's near-black background — wasteful and often unreadable on paper. Printing should always use a white background, regardless of the active on-screen theme.

## Scope

- `styles.css`: add a `@media print` block that overrides the same set of CSS custom properties `[data-theme='light']` already defines, to the same light-theme values — background, text, borders, buttons, everything switches together for print.
- Out of scope: no change to on-screen theming behavior (dark/light toggle unaffected), no hiding/rearranging of UI elements for print (buttons, nav, etc. still print as-is, just recolored) — this is a color-only fix.

## Approach

Overriding only the background variable(s) would leave dark-theme's light-gray text (`--text: #f3f4f6`) rendering on a white page — nearly invisible. Since every component rule in this app already references the CSS custom properties (`var(--bg)`, `var(--text)`, etc.) rather than hardcoded colors, the correct fix is to override the *whole* variable set for print, reusing the exact values `[data-theme='light']` already defines. This guarantees a coherent, readable light appearance (white background, dark text, light borders) regardless of whether dark or light theme is active on screen.

Both the base `:root` (dark defaults) and `[data-theme='light']` have equal CSS specificity (each is a single class-level selector), so which one applies is decided by cascade + attribute presence today. Adding a same-specificity `@media print { :root { ... } }` block *after* `[data-theme='light']` in the file means it wins during printing regardless of which theme was active on screen, via source order — no attribute-selector complexity needed.

Added at the end of the theme-variables section (after `[data-theme='light']`):
```css
@media print {
  :root {
    --bg: #ffffff;
    --surface: #f5f5f5;
    --surface-2: #ffffff;
    --text: #111111;
    --muted: #6b7280;
    --border: #d1d5db;
    --input-bg: #ffffff;
    --input-border: #cccccc;
    --accent: #f59e0b;
    --accent-text: #ffffff;
    --danger: #dc2626;
    --resume-bg: #fff7ed;
    --btn-bg: #ffffff;
    --btn-text: #111111;
    --popover-btn-bg: #e5e7eb;
    --table-border: #dddddd;
    --row-border: #f0f0f0;
  }
}
```

## Testing

Pure CSS — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. With dark theme active on screen, open the browser's print preview — background should be white, text dark and readable, not the on-screen dark palette.
2. With light theme active on screen, print preview should look the same as before (already light) — no regression.
3. The regular on-screen dark/light toggle still behaves exactly as before; only print output is affected.
