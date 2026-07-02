# Game-Screen Button Consistency (radius, Pos styling, height, glyph alignment)

## Problem

A cluster of small visual inconsistencies in the game screen's header/infobar area:

1. **Border-radius**: `.grid button` and `#clk-toggle` use `6px` (the app's dominant standard, used across most buttons in the app), but `.tfadj` (Fouls/TO +/-) and `.period-ctl button` (END HALF/END GAME/+OT) use `4px`. `#poss` (the Pos button) has no styling at all beyond `flex: 0 0 auto` — it renders as a plain native browser button with no theme colors, no border, no radius, which is why it visually stands out most.
2. **Light-mode contrast**: `.tfadj` and `.period-ctl button` hardcode `color: #fff`, while their `background` follows the theme variable `--btn-bg`, which is pure white (`#ffffff`) in light mode. Text on these buttons risks being invisible (white-on-white) in light mode.
3. **Height**: END HALF/END GAME/+OT (`.period-ctl button`) should be taller — 26px.
4. **Plus/minus glyph mismatch**: every `+`/`-` pair in the app (score adj, clock step, Fouls/TO adjust — 7 occurrences total) renders `−` (U+2212, a normal-width math minus sign) next to `＋` (U+FF0B, a **fullwidth** CJK-typesetting plus sign). Pairing a normal-width character with a fullwidth one is the likely cause of the reported vertical misalignment between the two buttons in a pair — fullwidth characters are designed for a CJK monospace grid and commonly render with different internal padding/baseline than a normal symbol in the same font stack.

## Scope

- `styles.css`: adjust `.tfadj`, `.period-ctl button`, and `#poss` rules only.
- `app.js`: replace all 7 occurrences of `＋` (U+FF0B) with `+` (U+002B) in the game-screen render markup (score adj, clock step, Fouls/TO adjust). `−` (U+2212) is unchanged.
- Out of scope: `.adj button` (score +/-) and `.clkstep` (clock -/+ step) keep their current lack of custom background/border/radius styling — not mentioned in this request, left as a separate concern.

## Approach

### Border-radius + contrast + height (`styles.css`)

Current:
```css
.period-ctl button { padding:4px 10px; font-weight:700; font-size:.8rem; border:1px solid var(--border); background:var(--btn-bg); color:#fff; border-radius:4px; }
.tfadj { width:26px; height:26px; padding:0; line-height:1; border-radius:4px; border:1px solid var(--border); background:var(--btn-bg); color:#fff; }
#poss { flex: 0 0 auto; }
```

Becomes:
```css
.period-ctl button { padding:4px 10px; font-weight:700; font-size:.8rem; border:1px solid var(--border); background:var(--btn-bg); color:var(--btn-text); border-radius:6px; height:26px; }
.tfadj { width:26px; height:26px; padding:0; line-height:1; border-radius:6px; border:1px solid var(--border); background:var(--btn-bg); color:var(--btn-text); }
#poss { flex: 0 0 auto; padding:4px 10px; font-weight:700; font-size:.8rem; border:1px solid var(--border); background:var(--btn-bg); color:var(--btn-text); border-radius:6px; }
```

`#poss` picks up the exact same padding/font/border/background/color/radius as `.period-ctl button` (its infobar sibling), just without the added height — Pos wasn't reported as needing to be taller. `.tfadj`'s own `width:26px; height:26px;` (already 26px, unchanged) is untouched.

### Plus/minus glyph fix (`app.js`)

All 7 occurrences of `＋` in the game-screen template literal (inside `renderGame()`, covering the two score `.adj` blocks, the two `.clkstep` buttons, and the four `.tfadj` foul/TO buttons) change to `+`. `−` (U+2212) is untouched — it's already a well-chosen glyph (better proportioned than a plain ASCII hyphen for a minus sign); the fix is specifically that `＋`'s fullwidth metrics don't match `−`'s normal-width metrics, not that either symbol individually is wrong.

## Testing

Pure CSS + markup character changes — no logic change, no automated test coverage applies (matches the precedent set by prior visual-only changes; `logic.test.js` doesn't test rendered markup). Manual verification (deferred to the user, since this sandbox has no browser):

1. Pos, Fouls/TO +/-, and END HALF/END GAME/+OT all show the same 6px corner rounding as 2PT/3PT/FT and START/STOP.
2. Pos now has a themed background/border matching its infobar siblings (not a plain native button).
3. Switch to light mode — confirm Fouls/TO +/- and END HALF/END GAME/+OT text is readable (not white-on-white).
4. END HALF (and, in the final period, END GAME/+OT) are visibly taller than before.
5. Score +/-, clock -/+, and Fouls/TO +/- buttons: the `+` and `−` in each pair are now the same visual height/weight (no more one looking vertically offset from the other).
