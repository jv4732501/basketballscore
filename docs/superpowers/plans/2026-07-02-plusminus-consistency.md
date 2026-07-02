# Plus/Minus Button Visual Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give score +/- (`.adj button`) and clock +/- (`.clkstep`) the same border/background/color/radius treatment as Fouls/TO +/- (`.tfadj`), and fix a color collision that made the TO row's border invisible in dark mode.

**Architecture:** One task, three CSS rule edits in `styles.css`. No JS changes, no new files.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- `.adj button` stays 32×32px; `.clkstep` stays 30×30px — no size change.
- `.tfadj` itself, its markup, and `.infobar` (the Fouls row) are untouched.
- No other button family is affected.

---

### Task 1: Style score/clock +/- to match Fouls/TO, fix TO-row border collision

**Files:**
- Modify: `styles.css:262-266` (`.adj button`), `styles.css:285-290` (`.clkstep`), `styles.css:323-325` (`.infobar.small`)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Update `.adj button`**

Find:
```css
.adj button {
  width: 32px;
  height: 32px;
  margin: 0 2px;
}
```

Replace with:
```css
.adj button {
  width: 32px;
  height: 32px;
  margin: 0 2px;
  padding: 0;
  line-height: 1;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```

- [ ] **Step 2: Update `.clkstep`**

Find:
```css
.clkstep {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 1.1rem;
}
```

Replace with:
```css
.clkstep {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```

(`padding: 0` and `font-size: 1.1rem` already exist — only `line-height`, `border`, `background`, `color`, `border-radius` are new.)

- [ ] **Step 3: Fix the TO-row background/border collision**

Find:
```css
.infobar.small {
  background: #374151;
}
```

Replace with:
```css
.infobar.small {
  background: #2b3442;
}
```

- [ ] **Step 4: Verify scope**

Run: `git diff styles.css`
Expected: exactly the three rule changes above (`.adj button`, `.clkstep`, `.infobar.small`) — no other selector in the file differs. Confirm `.tfadj` and `.infobar` (without `.small`) do not appear in the diff.

- [ ] **Step 5: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` — pure CSS change, count must match the pre-change baseline.

- [ ] **Step 6: Commit**

```bash
git add styles.css
git commit -m "Unify score/clock +- button styling with Fouls/TO; fix TO-row border collision"
```

- [ ] **Step 7: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic — matches the precedent set by prior visual-only changes). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. Score +/- and clock +/- buttons now show the same border/background/radius look as Fouls +/- and TO +/-, at their existing sizes (no size change).
2. In dark mode, the TO row's +/- buttons now show a visible border (previously invisible against the row background).
3. Fouls row's appearance is unchanged.
4. Light mode: all four +/- families still look consistent with each other.
