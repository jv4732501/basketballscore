# Active-Player Checklist Layout Fix (Cycle 23 follow-up)

## Problem

The per-game active-player checklist added in Cycle 23 (`renderActiveRoster`) has no dedicated CSS — its `<li><label><input type="checkbox">...</label></li>` markup relies entirely on the browser's default checkbox margin and default inline text flow. Reported symptoms: the checkbox has an excessive (~3px) left margin, is positioned oddly, and the player name sometimes wraps to a second line.

Root cause: no styles.css rule targets this `label`+`checkbox` pattern at all — it inherits only `.roster`/`.roster li`'s existing rules (background, padding, flex container with a single child), neither of which constrain the checkbox's own margin or the label's internal layout.

## Scope

- `styles.css`: two new rules, scoped to `.roster li label` and `.roster li input[type='checkbox']`.
- Out of scope: no markup change in `renderActiveRoster` — this is a pure CSS fix. The opponent roster (`renderRoster`, `which === 'opp'`, also using `.roster li` but with no `<label>`) is unaffected since these new selectors only match elements that don't exist in that context.

## Approach

Add:
```css
.roster li label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.roster li input[type='checkbox'] {
  margin: 0;
}
```

`margin: 0` removes the browser's default checkbox margin (commonly ~3-4px, browser-dependent) entirely; `gap: 6px` on the flex label replaces it with an explicit, consistent space between checkbox and text. `display: flex; align-items: center;` forces the checkbox and player name onto one row, vertically centered, which should eliminate the reported text-wrapping.

## Testing

Pure CSS — no logic, no automated test coverage applies (matches the precedent set by prior visual-only fixes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Each player row in Setup's active-roster checklist shows the checkbox and `#num name` on one line, reasonably spaced, no wrapping.
2. The opponent roster (Setup) and any other `.roster` list elsewhere in the app are visually unchanged.
