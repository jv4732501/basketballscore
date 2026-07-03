# Style Unstyled Add Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `#opp-add-btn`, `#te-add-btn`, and `#btn-add-team` the app's standard themed button look (border/background/color/radius).

**Architecture:** Two CSS changes in `styles.css`: extend `.add-player button` (covers both `#opp-add-btn` and `#te-add-btn`), add a new dedicated rule for `#btn-add-team`.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- No markup change, no other button touched.

---

### Task 1: Theme `.add-player button` and add `#btn-add-team` styling

**Files:**
- Modify: `styles.css:150-152` (`.add-player button`), and add a new rule after `.list` (currently `styles.css:771-775`)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Theme `.add-player button`**

Find:

```css
.add-player button {
  padding: 0 16px;
}
```

Replace with:

```css
.add-player button {
  padding: 0 16px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
}
```

- [ ] **Step 2: Add `#btn-add-team` styling**

Find:

```css
.list {
  list-style: none;
  padding: 0;
  margin: 0;
}
```

Add immediately after it:

```css
.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

#btn-add-team {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  border-radius: 6px;
  margin-bottom: 8px;
}
```

- [ ] **Step 3: Verify scope**

Run: `git diff styles.css`
Expected: `.add-player button` gained the four new properties; a new `#btn-add-team` rule was added after `.list` (which itself is unchanged). No other selector differs.

- [ ] **Step 4: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure CSS change, count must match the current baseline.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "Style Add and Add Team buttons"
```

- [ ] **Step 6: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. The opponent roster's "Add" button (Setup) is themed instead of a plain native button.
2. The Team Editor's "Add" button is themed the same way.
3. The Teams tab's "+ Add Team" button is themed, with reasonable spacing above the team list.
4. All three look correct in both dark and light theme.
