# Game-Screen Button Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align border-radius, styling, and height across Pos/Fouls-TO/END HALF-GAME-OT buttons, fix a light-mode contrast bug, and fix a plus/minus glyph mismatch causing visible vertical misalignment.

**Architecture:** One task touching two files — `styles.css` (three rule edits) and `app.js` (seven single-character replacements in `renderGame()`'s template literal). No new state, no new files, no logic change.

**Tech Stack:** Plain CSS (`styles.css`), vanilla JS template literal (`app.js`), no build step.

## Global Constraints

- `.adj button` (score +/-) and `.clkstep` (clock -/+ step) keep their current lack of custom background/border/radius styling — out of scope, do not touch.
- `−` (U+2212, MINUS SIGN) must not change anywhere — only `＋` (U+FF0B, FULLWIDTH PLUS SIGN) is replaced, with `+` (U+002B, PLUS SIGN).
- Exactly 7 occurrences of `＋` exist in `app.js` today, all inside `renderGame()`'s template literal (score adj ×2, clock step ×1, Fouls/TO adjust ×4) — after the fix, `grep -c "＋" app.js` must report 0, and `grep -c "−" app.js` must report the same count as before the change (unchanged).

---

### Task 1: Border-radius/styling/height fixes + plus glyph fix

**Files:**
- Modify: `styles.css:338-340` (`#poss`), `styles.css:348-356` (`.period-ctl button`), `styles.css:358-367` (`.tfadj`)
- Modify: `app.js` (7 occurrences of `＋` inside `renderGame()`, currently at lines 1245, 1251, 1259, 1265, 1268, 1272, 1279 — line numbers may shift slightly if whitespace differs at edit time; find by searching for the `＋` character, not by line number alone)

**Interfaces:** N/A — this is the only task in the plan; pure CSS/markup character changes, nothing here is consumed by other tasks.

- [ ] **Step 1: Update `#poss` in `styles.css`**

Find:
```css
#poss {
  flex: 0 0 auto;
}
```

Replace with:
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

- [ ] **Step 2: Update `.period-ctl button` in `styles.css`**

Find:
```css
.period-ctl button {
  padding: 4px 10px;
  font-weight: 700;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: #fff;
  border-radius: 4px;
}
```

Replace with:
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

(Three changes: `color: #fff` → `color: var(--btn-text)`; `border-radius: 4px` → `6px`; added `height: 26px`. Padding/font-weight/font-size/border/background are unchanged.)

- [ ] **Step 3: Update `.tfadj` in `styles.css`**

Find:
```css
.tfadj {
  width: 26px;
  height: 26px;
  padding: 0;
  line-height: 1;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: #fff;
}
```

Replace with:
```css
.tfadj {
  width: 26px;
  height: 26px;
  padding: 0;
  line-height: 1;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
}
```

(Two changes: `border-radius: 4px` → `6px`; `color: #fff` → `color: var(--btn-text)`. `width`/`height` — already `26px` — are unchanged, as is everything else.)

- [ ] **Step 4: Verify no other border-radius or color rule was touched**

Run: `git diff styles.css`
Expected: exactly the changes described in Steps 1-3 above (3 rule blocks), nothing else in the file differs.

- [ ] **Step 5: Replace all 7 fullwidth-plus characters in `app.js`**

Run this to confirm the starting count:

```bash
grep -c "＋" app.js
```
Expected: `7`

Then replace every `＋` (U+FF0B) with `+` (U+002B) in `app.js`. Do not touch any `−` (U+2212) character — only the fullwidth plus glyph changes. The 7 occurrences are the button-label text in `renderGame()`'s template literal, e.g. (one example; there are 7 total, all structurally similar — button element text content, not part of any string comparison, data attribute, or JS logic):

Before (one of the 7):
```js
          <button class="clkstep" data-clk="1">＋</button>
```

After:
```js
          <button class="clkstep" data-clk="1">+</button>
```

Apply the same single-character substitution to the other 6 occurrences (the two `.adj` score buttons and the four `.tfadj` foul/timeout buttons) — each has exactly one `＋` in its button text, immediately after a `−`-containing sibling button in the same line or an adjacent line.

- [ ] **Step 6: Verify the glyph replacement**

Run:
```bash
grep -c "＋" app.js
```
Expected: `0`

Run:
```bash
grep -c "−" app.js
```
Expected: same count as it was before Step 5 (this character must be completely unchanged — if this count differs from before your edit, you have accidentally modified a minus sign; STOP and investigate rather than proceeding).

- [ ] **Step 7: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` (same count as before this task — this is a pure markup/CSS change, `logic.test.js` doesn't test rendered HTML so it should be unaffected either way, but confirm nothing broke).

- [ ] **Step 8: Commit**

```bash
git add styles.css app.js
git commit -m "Align button radius/height/color and fix plus/minus glyph mismatch"
```

- [ ] **Step 9: Manual verification (deferred to the user)**

There is no automated test for the visual aspects of this change (pure CSS/markup, no logic — matches the precedent set by prior visual-only changes). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. Pos, Fouls/TO +/-, and END HALF (or END GAME/+OT in the final period) all show the same 6px corner rounding as 2PT/3PT/FT and START/STOP.
2. Pos now has a themed background/border matching its infobar siblings, not a plain native browser button.
3. Switch to light mode — confirm Fouls/TO +/- and END HALF/END GAME/+OT text is readable (not white-on-white).
4. END HALF (and, in the final period, END GAME/+OT) are visibly taller than before.
5. In each +/- pair (score, clock, Fouls/TO), the `+` and `−` now look the same height/weight — no more visible vertical offset between them.
