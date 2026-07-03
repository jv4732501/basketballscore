# Fix Roster Checkbox Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the large visual gap between each active-roster checkbox and its "#N Name" label text on Setup.

**Architecture:** Two properties added to one existing CSS rule in `styles.css`.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- No change to `.card input, .card select` itself.
- No markup change.

---

### Task 1: Reset checkbox `width`/`padding` inherited from `.card input`

**Files:**
- Modify: `styles.css` (`.roster li input[type='checkbox']`)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Add the reset properties**

Find:

```css
.roster li input[type='checkbox'] {
  margin: 0;
  flex-shrink: 0;
}
```

Replace with:

```css
.roster li input[type='checkbox'] {
  margin: 0;
  flex-shrink: 0;
  width: auto;
  padding: 0;
}
```

- [ ] **Step 2: Verify scope**

Run: `git diff styles.css`
Expected: exactly two lines added (`width: auto;`, `padding: 0;`) inside `.roster li input[type='checkbox']`. `.card input, .card select` and every other selector are unchanged.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure CSS change, count must match the current baseline.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Fix oversized checkbox spacing in active roster checklist"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. On Setup, the active-roster checklist's checkboxes sit close to their "#N Name" text, matching the spacing shown for the "Team" dropdown row above it.
2. Checking/unchecking a player still works exactly as before.
3. Looks correct in both dark and light theme.
