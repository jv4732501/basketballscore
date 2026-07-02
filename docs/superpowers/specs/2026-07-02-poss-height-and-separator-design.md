# POS/END HALF Height Match + Top/Bottom Separator Line

## Problem

Two small visual fixes to the game screen:

1. `.period-ctl button` (END HALF/END GAME/+OT) has an explicit `height: 26px` (added in a prior cycle); `#poss` does not. Every other property on the two rules is now identical (padding, font-size, font-weight, border, background, color, border-radius), so this single extra `height` declaration is the entire cause of the two-button-families looking slightly different heights. The user prefers POS's current (auto) height.
2. There's no visual break between the "top" area (score header, Fouls row, TO row) and the "bottom" area (Players columns and controls, i.e. `.court`) — the user wants a thin, light separator line between them.

## Scope

- `styles.css`: remove `.period-ctl button`'s `height: 26px` declaration; add `border-top: 1px solid var(--border);` to `.court`.
- Out of scope: no other property on either rule changes; no new DOM elements; `#poss` itself is untouched (it's already the reference size).

## Approach

### Height match

Current:
```css
.period-ctl button {
  padding: 4px 10px;
  font-weight: 700;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
  height: 26px;
}
```

Becomes:
```css
.period-ctl button {
  padding: 4px 10px;
  font-weight: 700;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```

This is now byte-for-byte identical to `#poss`'s rule (`styles.css:345-354`), so both auto-size from the same padding/font-size/border, guaranteeing an exact height match rather than tuning a new pixel value by guesswork.

### Separator line

`.court` (`styles.css:405-409`) is the container immediately following the TO row (`.infobar.small`) in `renderGame()`'s markup — it holds the Players columns and the center controls grid. Adding a top border there draws exactly the requested line at the top/bottom boundary, with no new HTML element and no default-`<hr>`-styling to reset:

Current:
```css
.court {
  display: flex;
  flex: 1;
  overflow: hidden;
}
```

Becomes:
```css
.court {
  display: flex;
  flex: 1;
  overflow: hidden;
  border-top: 1px solid var(--border);
}
```

`var(--border)` is the same variable already used throughout the file for subtle dividers (e.g. every `.grid button`, `.tfadj`, `#clk-toggle` border) — reusing it keeps the separator theme-aware (adapts automatically between dark and light mode) without introducing a new color value.

## Testing

Pure CSS changes — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. POS and END HALF (or END GAME/+OT in the final period) are now the same height.
2. A thin line is visible between the TO row and the Players/controls area below it, in both dark and light mode.
3. No other part of the game screen changed appearance.
