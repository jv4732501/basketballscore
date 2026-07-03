# Style Unstyled "Add" Buttons

## Problem

Three buttons render as plain native browser buttons with no theming: `#opp-add-btn` and `#te-add-btn` (both "Add", covered by the shared `.add-player button` rule, which only sets `padding: 0 16px;` — no background/border/color/radius), and `#btn-add-team` ("+ Add Team", added in Cycle 23, with no CSS rule at all).

## Scope

- `styles.css`: add full theming to `.add-player button` (fixes both `#opp-add-btn` and `#te-add-btn` at once, since both are inside `.add-player` containers); add a new dedicated rule for `#btn-add-team`.
- Out of scope: no other button, no markup change.

## Approach

Current:
```css
.add-player button {
  padding: 0 16px;
}
```

Becomes:
```css
.add-player button {
  padding: 0 16px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```

New rule for `#btn-add-team` (added near `renderTeams`'s other styling, e.g. after `.list`):
```css
#btn-add-team {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
  margin-bottom: 8px;
}
```

All three now match the app's established button convention (`var(--border)`/`var(--btn-bg)`/`var(--btn-text)`/6px radius), consistent with `.grid button`, `.listrow button`, `#clk-toggle`, etc.

## Testing

Pure CSS — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. The opponent roster's "Add" button (Setup) is themed (border, background, radius) instead of a plain native button.
2. The Team Editor's "Add" button is themed the same way.
3. The Teams tab's "+ Add Team" button is themed, with reasonable spacing above the team list.
4. All three look correct in both dark and light theme.
