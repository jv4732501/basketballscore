# POS/END HALF Explicit Height Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin `#poss` and `.period-ctl button` (END HALF/END GAME/+OT) to the same explicit `height: 26px`, since their auto-computed heights diverge (measured: 26.29px vs 24px) due to an ancestor flex-layout difference, not a mismatched property on the buttons themselves.

**Architecture:** One CSS edit in `styles.css`: add `height: 26px;` to both `#poss` and `.period-ctl button`.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- No other property on `#poss` or `.period-ctl button` changes.
- `.period-ctl`'s own flex properties (the wrapper causing the root-cause discrepancy) are not touched.

---

### Task 1: Add explicit height to `#poss` and `.period-ctl button`

**Files:**
- Modify: `styles.css:345-354` (`#poss`), `styles.css:362-370` (`.period-ctl button`)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Add `height: 26px;` to `#poss`**

Find:
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
  height: 26px;
}
```

- [ ] **Step 2: Add `height: 26px;` to `.period-ctl button`**

Find:
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

- [ ] **Step 3: Verify scope**

Run: `git diff styles.css`
Expected: exactly two `+  height: 26px;` lines added, one under `#poss`, one under `.period-ctl button` — no other selector in the file differs.

- [ ] **Step 4: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` — pure CSS change, count must match the pre-change baseline.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "Pin POS and END HALF/END GAME/+OT to the same explicit height"
```

- [ ] **Step 6: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic — matches the precedent set by prior visual-only changes). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. POS and END HALF (or END GAME/+OT in the final period) now measure the same height in browser dev tools.
2. No other part of the game screen changed appearance.
