# Popover (Long-Press Menu) Button Background Color

## Problem

The long-press context menu (`.popmenu`, shown for shot/foul modifiers like "Shooting", "Miss", etc.) renders its option buttons with `background:var(--btn-bg)` — the exact same color used by every regular grid button (`.grid button`, 2PT/3PT/FT/etc.). This makes the popover options visually blend in with the surrounding buttons instead of reading as a distinct, floating menu.

## Scope

- `styles.css`: add a new theme variable `--popover-btn-bg` (dark and light values) and use it for `.popmenu button`'s `background`.
- Out of scope: the popover container (`.popmenu`, its border/shadow/border-radius), any other button in the app, and the popover's text color (`--btn-text` stays as-is — both new background shades keep sufficient contrast with it).

## Approach

Follow the file's existing pattern of one CSS variable per semantic role (`--btn-bg`, `--surface`, `--surface-2`, etc.) rather than hardcoding colors inline or reusing an unrelated existing variable's value.

`:root` (dark, default) gains:
```css
--popover-btn-bg:#333b4d;
```
One step lighter than `--btn-bg:#262c38`, continuing the same lightening progression already used for `--bg:#0f1115 → --surface:#1b1f27 → --btn-bg:#262c38`.

`[data-theme="light"]` gains:
```css
--popover-btn-bg:#e5e7eb;
```
A light gray, distinct from the current pure-white `--btn-bg:#ffffff`, without being as dark/saturated as `--border:#d1d5db`.

`.popmenu button` (styles.css:111) changes from:
```css
.popmenu button { padding:10px 16px; font-weight:600; white-space:nowrap; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```
to:
```css
.popmenu button { padding:10px 16px; font-weight:600; white-space:nowrap; background:var(--popover-btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```

Only the `background` property's value source changes (from `--btn-bg` to `--popover-btn-bg`); everything else on that rule (padding, font-weight, border, border-radius, text color) is untouched.

## Testing

Pure CSS color tweak — no logic change, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user):

1. In dark mode, long-press a shot/foul button to open the modifier popover — confirm its option buttons are now a visibly lighter gray than the surrounding grid buttons.
2. Switch to light mode, repeat — confirm the popover options are now a visible light gray, distinct from the surrounding white grid buttons.
3. Confirm popover button text stays readable in both themes.
4. Confirm no other button anywhere in the app changed color.
