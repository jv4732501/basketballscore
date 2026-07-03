# In-Game Add-Open Auto-Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When "+ Add" is tapped to open the in-game add-player form (either team), focus lands directly in the "#" number input.

**Architecture:** One line added to the `[data-addopen]` click handler in `app.js`'s `wireGame`.

**Tech Stack:** Vanilla JS (`app.js`), no build step.

## Global Constraints

- No change to `[data-addclose]` ("Close" button) or `[data-addgo]` (the "Add" button, already fixed in Cycle 32) wiring.

---

### Task 1: Auto-focus the number field when the add form opens

**Files:**
- Modify: `app.js` (the `[data-addopen]` click handler inside `wireGame`)

**Interfaces:** N/A — this is the only task in the plan; pure behavior addition, nothing here is consumed by other tasks.

- [ ] **Step 1: Add focus call to the `[data-addopen]` handler**

Find:

```js
  el_each(
    '[data-addopen]',
    (b) =>
      (b.onclick = () => {
        addOpen = b.dataset.addopen;
        render();
      }),
  );
```

Replace with:

```js
  el_each(
    '[data-addopen]',
    (b) =>
      (b.onclick = () => {
        addOpen = b.dataset.addopen;
        render();
        document.querySelector(`[data-addnum="${addOpen}"]`).focus();
      }),
  );
```

- [ ] **Step 2: Verify scope**

Run: `git diff app.js`
Expected: exactly one line added — `document.querySelector(\`[data-addnum="${addOpen}"]\`).focus();` — inside the `[data-addopen]` handler, right after `render();`. The `[data-addclose]` and `[data-addgo]` handlers, and every other line, are unchanged.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — this handler has no existing test coverage (DOM-driven, not a pure function), so this confirms nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "Focus number field when opening the in-game add form"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure UI-interaction behavior, no logic to unit test). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. During a live game, tapping "+ Add" for either team opens the add-player form with the cursor already in the "#" field, ready to type immediately.
2. This works independently for both "my" team and "opp" team's add-forms.
3. Adding a player still returns focus to "#" afterward (Cycle 32's fix), and "Close" still works as before.
