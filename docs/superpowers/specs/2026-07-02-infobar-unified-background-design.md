# Unify Infobar (Fouls/TO row) Background

## Problem

The game screen's Fouls row (`.infobar`, background `#1f2937`) and TO row (`.infobar.small`, background `#2b3442`) use two different dark shades, creating a visible two-tone effect the user doesn't like. The two rules also have to be kept in sync by hand — this exact drift already caused a real bug (Cycle 16): `.infobar.small`'s background briefly collided byte-for-byte with `--border`, making `.tfadj`'s border invisible on that row.

## Scope

- `styles.css`: change `.infobar`'s `background` from `#1f2937` to `#111` (matching the existing `.gh` header background directly above it); delete the `.infobar.small` rule entirely, since its only property (the now-redundant background override) goes away.
- Out of scope: no other property on `.infobar` changes; `.gh` itself is untouched; no markup change (`class="infobar small"` stays as-is — `.infobar.small`'s selector simply has no matching rule left, which is valid CSS).

## Approach

Current:
```css
.infobar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: #1f2937;
  color: #fff;
  font-size: 0.8rem;
}

.infobar.small {
  background: #2b3442;
}
```

Becomes:
```css
.infobar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: #111;
  color: #fff;
  font-size: 0.8rem;
}
```

Both the Fouls row (`class="infobar"`) and the TO row (`class="infobar small"`) now resolve to the same `#111` background via the normal CSS cascade — no rule targets `.small` specifically anymore, so there's nothing left to drift out of sync.

## Testing

Pure CSS change — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. The Fouls row and TO row now show the same dark background as each other and as the score header (`.gh`) above them.
2. Text and buttons in both rows remain readable (white text/themed buttons against the new `#111` background).
3. No other part of the game screen changed appearance.
