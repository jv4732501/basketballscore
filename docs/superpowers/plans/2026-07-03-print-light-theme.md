# Force Light Theme When Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Printing the page always uses a white background and readable dark text, regardless of the active on-screen theme.

**Architecture:** One `@media print` block added to `styles.css`, reusing `[data-theme='light']`'s exact variable values.

**Tech Stack:** Plain CSS (`styles.css`), no build step.

## Global Constraints

- No change to on-screen theming behavior (dark/light toggle unaffected).
- No hiding/rearranging of UI elements for print — this is a color-only fix.

---

### Task 1: Add the `@media print` theme override

**Files:**
- Modify: `styles.css` (append after the `[data-theme='light']` block)

**Interfaces:** N/A — this is the only task in the plan; pure CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Add the print media block**

Find:

```css
[data-theme='light'] {
  --bg: #ffffff;
  --surface: #f5f5f5;
  --surface-2: #ffffff;
  --text: #111111;
  --muted: #6b7280;
  --border: #d1d5db;
  --input-bg: #ffffff;
  --input-border: #cccccc;
  --accent: #f59e0b;
  --accent-text: #ffffff;
  --danger: #dc2626;
  --resume-bg: #fff7ed;
  --btn-bg: #ffffff;
  --btn-text: #111111;
  --popover-btn-bg: #e5e7eb;
  --table-border: #dddddd;
  --row-border: #f0f0f0;
}
```

Add immediately after it:

```css
[data-theme='light'] {
  --bg: #ffffff;
  --surface: #f5f5f5;
  --surface-2: #ffffff;
  --text: #111111;
  --muted: #6b7280;
  --border: #d1d5db;
  --input-bg: #ffffff;
  --input-border: #cccccc;
  --accent: #f59e0b;
  --accent-text: #ffffff;
  --danger: #dc2626;
  --resume-bg: #fff7ed;
  --btn-bg: #ffffff;
  --btn-text: #111111;
  --popover-btn-bg: #e5e7eb;
  --table-border: #dddddd;
  --row-border: #f0f0f0;
}

@media print {
  :root {
    --bg: #ffffff;
    --surface: #f5f5f5;
    --surface-2: #ffffff;
    --text: #111111;
    --muted: #6b7280;
    --border: #d1d5db;
    --input-bg: #ffffff;
    --input-border: #cccccc;
    --accent: #f59e0b;
    --accent-text: #ffffff;
    --danger: #dc2626;
    --resume-bg: #fff7ed;
    --btn-bg: #ffffff;
    --btn-text: #111111;
    --popover-btn-bg: #e5e7eb;
    --table-border: #dddddd;
    --row-border: #f0f0f0;
  }
}
```

- [ ] **Step 2: Verify scope**

Run: `git diff styles.css`
Expected: exactly one new `@media print { :root { ... } }` block added right after `[data-theme='light']` (which itself is unchanged). No other selector in the file differs.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure CSS change, count must match the current baseline.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Force light theme when printing"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. With dark theme active on screen, open the browser's print preview — background should be white, text dark and readable, not the on-screen dark palette.
2. With light theme active on screen, print preview should look the same as before (already light) — no regression.
3. The regular on-screen dark/light toggle still behaves exactly as before; only print output is affected.
