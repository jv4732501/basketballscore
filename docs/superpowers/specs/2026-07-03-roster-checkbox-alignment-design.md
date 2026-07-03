# Fix Roster Checkbox Alignment (Oversized Checkbox Box)

## Problem

The Setup screen's active-roster checklist shows a large gap between each checkbox and its "#N Name" label text, instead of the intended tight ~6px spacing.

## Root Cause

The roster `<ul class="roster">` sits inside the "Team" card (`<section class="card">`). `.card input, .card select { width: 100%; padding: 10px; ... }` targets every `<input>` inside a `.card` — including `<input type="checkbox">` — since it doesn't restrict by input `type`. The existing `.roster li input[type='checkbox']` rule only resets `margin` and `flex-shrink`, so `width: 100%` and `padding: 10px` still cascade in from `.card input` (no competing rule sets those two properties for the checkbox), inflating the checkbox's actual bounding box to the label's full width plus padding. The visible checkmark glyph still renders at its normal small size, but the flex `gap: 6px` between it and the `<span>` is measured from the edge of that oversized invisible box, producing the large visual gap.

## Scope

- `styles.css`: `.roster li input[type='checkbox']` gains `width: auto; padding: 0;`, overriding the two unwanted inherited properties.
- Out of scope: no change to `.card input, .card select` itself (still correct for the text/select inputs it's meant for), no markup change. The Team Editor's roster (`.listrow`) doesn't use checkboxes at all, so it's unaffected either way.

## Approach

Current:
```css
.roster li input[type='checkbox'] {
  margin: 0;
  flex-shrink: 0;
}
```

Becomes:
```css
.roster li input[type='checkbox'] {
  margin: 0;
  flex-shrink: 0;
  width: auto;
  padding: 0;
}
```

## Testing

Pure CSS — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. On Setup, the active-roster checklist's checkboxes sit close to their "#N Name" text, matching the spacing shown for the "Team" dropdown row above it.
2. Checking/unchecking a player still works exactly as before.
3. Looks correct in both dark and light theme.
