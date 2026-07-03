# Active-Player Checklist Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the per-game active-player checklist's checkbox spacing/wrapping by adding dedicated CSS for its `label`+`checkbox` markup.

**Architecture:** One CSS addition in `styles.css`, scoped narrowly so only the checklist is affected.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- No markup change in `renderActiveRoster` — this is a pure CSS fix.
- The opponent roster (`renderRoster`, `which === 'opp'`, also using `.roster li` but with no `<label>`) must be visually unaffected — the new selectors only match elements that exist in the checklist, not the opponent roster.

---

### Task 1: Add checklist label/checkbox CSS

**Files:**
- Modify: `styles.css:144-157` (add two new rules after `.roster li`)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Add the new CSS rules**

Find:

```css
.roster li {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--surface-2);
  border-radius: 6px;
  margin-bottom: 4px;
}
```

Replace with:

```css
.roster li {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--surface-2);
  border-radius: 6px;
  margin-bottom: 4px;
}

.roster li label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.roster li input[type='checkbox'] {
  margin: 0;
}
```

- [ ] **Step 2: Verify scope**

Run: `git diff styles.css`
Expected: exactly two new rules added after the existing `.roster li` rule (which itself is unchanged) — no other selector in the file differs.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure CSS change, count must match the current baseline.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Fix active-roster checklist checkbox spacing and wrapping"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. Each player row in Setup's active-roster checklist shows the checkbox and `#num name` on one line, reasonably spaced, no wrapping.
2. The opponent roster (Setup) and any other `.roster` list elsewhere in the app are visually unchanged.
