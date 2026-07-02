# POS Height Match + Top/Bottom Separator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make END HALF/END GAME/+OT match POS's height exactly, and add a thin separator line between the top area (header/Fouls/TO) and the Players/controls area below it.

**Architecture:** Two CSS edits in `styles.css`: remove one property from `.period-ctl button`, add one property to `.court`.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- `#poss` itself is not modified — it's already the reference size.
- No other property on `.period-ctl button` or `.court` changes.
- No new DOM elements/markup changes.

---

### Task 1: Remove `.period-ctl button`'s explicit height; add separator border to `.court`

**Files:**
- Modify: `styles.css:362-371` (`.period-ctl button`), `styles.css:405-409` (`.court`)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Remove `.period-ctl button`'s `height: 26px`**

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
  height: 26px;
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
}
```

- [ ] **Step 2: Add a top border to `.court`**

Find:
```css
.court {
  display: flex;
  flex: 1;
  overflow: hidden;
}
```

Replace with:
```css
.court {
  display: flex;
  flex: 1;
  overflow: hidden;
  border-top: 1px solid var(--border);
}
```

- [ ] **Step 3: Verify scope**

Run: `git diff styles.css`
Expected: exactly the two changes above (`.period-ctl button` loses `height: 26px;`; `.court` gains `border-top: 1px solid var(--border);`) — no other selector in the file differs.

- [ ] **Step 4: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` — pure CSS change, count must match the pre-change baseline.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "Match POS/END HALF button heights; add top/bottom separator line"
```

- [ ] **Step 6: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic — matches the precedent set by prior visual-only changes). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. POS and END HALF (or END GAME/+OT in the final period) are now the same height.
2. A thin line is visible between the TO row and the Players/controls area below it, in both dark and light mode.
3. No other part of the game screen changed appearance.
