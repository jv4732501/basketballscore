# Style Cancel Buttons in Tip-Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Cancel buttons in Team Editor and the Player Edit dialog the app's outlined button look, matching their neighboring Save buttons.

**Architecture:** One CSS selector broadened in `styles.css` — no markup change.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- No markup change — no new classes added to any button.
- `.toggle button`'s own behavior and appearance must be unaffected.
- `.tip-row .tip` (Save's accent-fill + min-height) must remain unchanged and still win the cascade for `.tip`-classed buttons.

---

### Task 1: Broaden `.tip-row .tip` to `.tip-row button`

**Files:**
- Modify: `styles.css` (the `.toggle button, .tip-row .tip { ... }` rule)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Broaden the selector**

Find:

```css
.toggle button,
.tip-row .tip {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--text);
  border-radius: 8px;
  font-weight: 600;
}
```

Replace with:

```css
.toggle button,
.tip-row button {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--text);
  border-radius: 8px;
  font-weight: 600;
}
```

The rule immediately following this one (`.tip-row .tip { background: var(--accent); color: var(--accent-text); min-height: 52px; }`) stays exactly as-is — do not touch it. It remains more specific than `.toggle button, .tip-row button`, so it continues to apply its accent-fill only to `.tip`-classed buttons (Save), leaving Cancel with just the base outlined look from the broadened rule.

- [ ] **Step 2: Verify scope**

Run: `git diff styles.css`
Expected: exactly one line changed (`.tip-row .tip` → `.tip-row button` in the selector list). The `.tip-row .tip { background: var(--accent); ... }` rule right after it, and every other selector in the file, is unchanged.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure CSS change, count must match the current baseline.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Style Cancel buttons in tip-rows"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. Team Editor's "Cancel" button is now outlined/bordered, matching the app's button convention, instead of a plain native button.
2. The Player Edit dialog's "Cancel" button (opened via long-pressing a player) is styled the same way.
3. Both "Save" buttons still look exactly as before (accent-filled, unchanged).
4. The Home/Away toggle buttons on Setup (`.toggle button`) are visually unaffected.
