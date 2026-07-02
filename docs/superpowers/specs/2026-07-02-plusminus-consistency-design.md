# Plus/Minus Button Visual Consistency

## Problem

The app has four families of +/- buttons: score adjust (`.adj button`), clock step (`.clkstep`), Fouls adjust (`.tfadj`, via `data-tf`), and timeout adjust (`.tfadj`, via `data-to`). Fouls and TO already share the same `.tfadj` class and CSS (border, themed background/text, 6px radius — fixed in the prior button-consistency cycle), but score and clock buttons have no custom styling at all — no border, no themed background, no radius — so they render with plain native browser button chrome, visually inconsistent with Fouls/TO.

Separately, a real bug was found while investigating: the TO row's container (`.infobar.small`, background `#374151`) uses the **exact same hex value** as `--border` (`#374151` in dark theme), so `.tfadj`'s `border: 1px solid var(--border)` is rendered in a color identical to its own row's background — completely invisible in dark mode. This is why TO looked borderless even though it already shares `.tfadj` with Fouls (whose row, `.infobar`, has a different, non-colliding background of `#1f2937`).

## Scope

- `styles.css`: add border/background/color/radius/line-height to `.adj button` and `.clkstep`, matching `.tfadj`'s treatment; change `.infobar.small`'s background to a value distinct from `--border`.
- Sizes are unchanged: `.adj button` stays 32×32px, `.clkstep` stays 30×30px.
- `.tfadj` itself, its markup, and `.infobar` (the Fouls row) are untouched.
- Out of scope: no logic changes; no other button family affected.

## Approach

### `.adj button` (score +/-)

Current:
```css
.adj button {
  width: 32px;
  height: 32px;
  margin: 0 2px;
}
```

Becomes:
```css
.adj button {
  width: 32px;
  height: 32px;
  margin: 0 2px;
  padding: 0;
  line-height: 1;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```

`padding: 0` and `line-height: 1` are added (not present today) because, like `.tfadj`, these buttons have a fixed pixel size and need the glyph vertically centered without default browser button padding interfering — the same technique `.tfadj` already uses for its own fixed 26×26 box.

### `.clkstep` (clock -/+)

Current:
```css
.clkstep {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 1.1rem;
}
```

Becomes:
```css
.clkstep {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```

`font-size: 1.1rem` (already present, pre-existing and larger than `.tfadj`'s default) is left as-is — this is a font-size difference, not part of the border/background/radius consistency being fixed here.

### `.infobar.small` (TO row background collision fix)

Current:
```css
.infobar.small {
  background: #374151;
}
```

Becomes:
```css
.infobar.small {
  background: #2b3442;
}
```

`#2b3442` is close to the current `#374151` (preserving the existing two-tone effect between the Fouls row and the TO row) but no longer identical to `--border`'s dark-theme value, so `.tfadj`'s existing border becomes visible on the TO row again. This only affects dark mode in practice — in light mode `--border` (`#d1d5db`) never collided with this hardcoded dark bar background in the first place.

## Testing

Pure CSS changes — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Score +/- and clock +/- buttons now show the same border/background/radius treatment as Fouls +/- and TO +/-, at their existing sizes (no size change).
2. In dark mode, the TO row's +/- buttons now show a visible border (previously invisible against the row background).
3. Fouls row's appearance is unchanged.
4. Light mode: all four +/- families still look consistent with each other (no new light-mode regression).
