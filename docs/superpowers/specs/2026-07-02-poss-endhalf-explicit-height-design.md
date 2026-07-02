# POS/END HALF Explicit Height Pin (Cycle 19 Follow-Up)

## Problem

Cycle 19 removed `.period-ctl button`'s explicit `height: 26px`, expecting it to auto-size identically to `#poss` since every other CSS property on the two rules was already byte-identical. In practice this didn't hold: measured in-browser, `#poss` renders at 26.29px while END HALF/END GAME/+OT render at 24px — a real ~2.3px gap remains.

Root cause: `.period-ctl` (the `<span>` wrapping END HALF/END GAME/+OT) is `display: flex` with no `align-items` set, defaulting to `stretch`. `#poss` sits directly inside `.infobar`, which sets `align-items: center` and does not stretch its children. This structural difference in ancestor flex behavior — not a mismatched property on the buttons themselves — is why the two button families' auto-computed heights diverge despite identical own CSS.

## Scope

- `styles.css`: add `height: 26px;` to both `#poss` and `.period-ctl button`, pinning both to the same explicit value rather than relying on auto-sizing.
- Out of scope: no change to `.period-ctl`'s own flex properties (not touching the root cause's flex-stretch behavior directly — pinning both buttons' heights explicitly sidesteps it without needing to change the wrapper's layout, which could have other side effects).

## Approach

Current:
```css
#poss {
  flex: 0 0 auto;
  padding: 4px 10px;
  font-weight: 700;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```
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

Becomes:
```css
#poss {
  flex: 0 0 auto;
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

Both rules now explicitly declare the same `height: 26px`, guaranteeing an exact pixel match regardless of the ancestor flex-stretch behavior that caused the previous auto-sizing approach to diverge.

## Testing

Pure CSS change — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. POS and END HALF (or END GAME/+OT in the final period) now measure the same height in browser dev tools.
2. No other part of the game screen changed appearance.
