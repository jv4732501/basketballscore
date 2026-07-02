# Unify Infobar Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Fouls row and TO row on the game screen the same background color, removing the two-tone effect and the now-redundant `.infobar.small` rule.

**Architecture:** One CSS edit in `styles.css`: change `.infobar`'s background, delete `.infobar.small` entirely.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- No other property on `.infobar` changes.
- `.gh` (the score header) is untouched.
- No markup change — `class="infobar small"` stays exactly as it is in `app.js`; `.infobar.small` simply has no matching CSS rule left after this change, which is valid.

---

### Task 1: Unify `.infobar` background, remove `.infobar.small`

**Files:**
- Modify: `styles.css:324-336` (`.infobar` and `.infobar.small` rules)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Change `.infobar`'s background and delete `.infobar.small`**

Find:
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

Replace with:
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

- [ ] **Step 2: Verify scope**

Run: `git diff styles.css`
Expected: only the `.infobar` rule's `background` value changed (`#1f2937` → `#111`), and the `.infobar.small` rule block is gone entirely. No other selector in the file differs.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` — pure CSS change, count must match the pre-change baseline.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Unify Fouls/TO infobar rows to one background color"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic — matches the precedent set by prior visual-only changes). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. The Fouls row and TO row now show the same dark background as each other and as the score header (`.gh`) above them.
2. Text and buttons in both rows remain readable.
3. No other part of the game screen changed appearance.
