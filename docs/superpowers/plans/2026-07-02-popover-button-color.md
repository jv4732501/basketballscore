# Popover Button Background Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the long-press context menu (`.popmenu`) option buttons a background color distinct from the surrounding grid buttons, in both dark and light mode, so the menu no longer blends in.

**Architecture:** One new theme CSS variable (`--popover-btn-bg`, defined once per theme) consumed by a single existing selector (`.popmenu button`). No new files, no JS changes.

**Tech Stack:** Plain CSS (`styles.css`), no build step, no new dependencies.

## Global Constraints

- Only `.popmenu button`'s `background` changes — no other property on that rule, and no other selector in the file, may change.
- Dark theme (`:root`) gets `--popover-btn-bg:#333b4d`.
- Light theme (`[data-theme="light"]`) gets `--popover-btn-bg:#e5e7eb`.
- `--btn-text` (the popover button text color) stays unchanged in both themes.

---

### Task 1: Add `--popover-btn-bg` variable and wire it into `.popmenu button`

**Files:**
- Modify: `styles.css:4-12` (`:root` theme block — add the dark variable)
- Modify: `styles.css:13-21` (`[data-theme="light"]` theme block — add the light variable)
- Modify: `styles.css:111` (`.popmenu button` rule — swap `--btn-bg` for `--popover-btn-bg` in the `background` property only)

**Interfaces:** N/A — this is the only task in the plan; nothing here is consumed elsewhere.

- [ ] **Step 1: Add the dark-theme variable**

In `styles.css`, find this line inside the `:root` block:

```css
  --btn-bg:#262c38; --btn-text:#f3f4f6;
```

Replace it with:

```css
  --btn-bg:#262c38; --btn-text:#f3f4f6; --popover-btn-bg:#333b4d;
```

- [ ] **Step 2: Add the light-theme variable**

In `styles.css`, find this line inside the `[data-theme="light"]` block:

```css
  --btn-bg:#ffffff; --btn-text:#111111;
```

Replace it with:

```css
  --btn-bg:#ffffff; --btn-text:#111111; --popover-btn-bg:#e5e7eb;
```

- [ ] **Step 3: Point `.popmenu button` at the new variable**

In `styles.css`, find this line:

```css
.popmenu button { padding:10px 16px; font-weight:600; white-space:nowrap; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```

Replace it with:

```css
.popmenu button { padding:10px 16px; font-weight:600; white-space:nowrap; background:var(--popover-btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```

Only the `background` value changes (`--btn-bg` → `--popover-btn-bg`); padding, font-weight, white-space, color, border, and border-radius are untouched. Do not modify `.popmenu` (the container rule) or any other selector.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Give long-press popover buttons a distinct background color"
```

- [ ] **Step 5: Manual verification**

There is no automated test for this (pure CSS color change, no logic to unit-test — matches the precedent set by prior visual-only changes). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. In dark mode, long-press a shot/foul button to open the modifier popover — confirm the option buttons are now a visibly lighter gray than the surrounding grid buttons.
2. Switch to light mode, repeat — confirm the popover options are now a visible light gray, distinct from the surrounding white grid buttons.
3. Confirm popover button text is still readable in both themes.
4. Confirm no other button anywhere in the app changed color.
