# Style Cancel Buttons in Tip-Rows

## Problem

`#te-cancel` (Team Editor) and `#pe-cancel` (the Player Edit dialog, two occurrences) sit in a `.tip-row` next to a "Save" button that has `class="tip"`. `.tip-row .tip` gives Save the app's outlined/accent-filled look, but the Cancel buttons have no class at all, so they render as plain native browser buttons.

## Scope

- `styles.css`: broaden the selector `.toggle button, .tip-row .tip` to `.toggle button, .tip-row button` — this applies the base outlined button look (flex, padding, border, radius, font-weight) to every button inside a `.tip-row`, not just `.tip`-classed ones. The separate, more specific `.tip-row .tip` rule (accent background + min-height) still applies only to Save, since it remains untouched and wins the cascade for `.tip`-classed buttons.
- Out of scope: no markup change (no new classes added to any button); `.toggle button`'s own behavior is unaffected, since it's unrelated to `.tip-row` and this change doesn't touch its selector's meaning.

## Approach

Current:
```css
.toggle button,
.tip-row .tip {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--text);
  border-radius: 8px;
  font-weight: 600;
}
```

Becomes:
```css
.toggle button,
.tip-row button {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--text);
  border-radius: 8px;
  font-weight: 600;
}
```

The following rule (unchanged) still layers the accent fill on top for Save specifically:
```css
.tip-row .tip {
  background: var(--accent);
  color: var(--accent-text);
  min-height: 52px;
}
```

This fixes both known Cancel buttons in one change, since both `#te-cancel` and `#pe-cancel` share the same "plain `<button>Cancel</button>` inside a `.tip-row`" markup pattern.

## Testing

Pure CSS — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Team Editor's "Cancel" button is now outlined/bordered, matching the app's button convention, instead of a plain native button.
2. The Player Edit dialog's "Cancel" button (opened via long-pressing a player) is styled the same way.
3. Both "Save" buttons still look exactly as before (accent-filled, unchanged).
4. The Home/Away toggle buttons on Setup (`.toggle button`) are visually unaffected.
