# Auto-Focus Number Field After Adding a Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After adding a player (opponent roster on Setup, or a team's roster in the Team Editor), automatically move focus back to the "#" input, ready for the next entry.

**Architecture:** One line added to each of two existing functions in `app.js` — `addPlayer` (opponent roster) and the Team Editor's local `add` function.

**Tech Stack:** Vanilla JS (`app.js`), no build step.

## Global Constraints

- No change to validation — a blank/invalid number still silently no-ops (no player added, no focus change), unchanged from today.
- No change to the name field, or any other add/remove flow.

---

### Task 1: Auto-focus `#opp-add-num` and `#te-add-num` after adding a player

**Files:**
- Modify: `app.js` (`addPlayer(numEl, nameEl)` function; the Team Editor's local `add` function inside `renderTeamEditor`)

**Interfaces:** N/A — this is the only task in the plan; pure behavior addition, nothing here is consumed by other tasks.

- [ ] **Step 1: Add focus call to `addPlayer`**

Find:

```js
function addPlayer(numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  setupDraft.oppPlayers.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
}
```

Replace with:

```js
function addPlayer(numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  setupDraft.oppPlayers.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
  document.getElementById('opp-add-num').focus();
}
```

- [ ] **Step 2: Add focus call to the Team Editor's `add`**

Find:

```js
  const add = () => {
    const num = parseInt($('te-add-num').value, 10);
    if (isNaN(num)) return;
    d.players.push({ id: makeLocalId(), num, name: $('te-add-name').value.trim() });
    renderTeams();
  };
```

Replace with:

```js
  const add = () => {
    const num = parseInt($('te-add-num').value, 10);
    if (isNaN(num)) return;
    d.players.push({ id: makeLocalId(), num, name: $('te-add-name').value.trim() });
    renderTeams();
    document.getElementById('te-add-num').focus();
  };
```

- [ ] **Step 3: Verify scope**

Run: `git diff app.js`
Expected: exactly two one-line additions — `document.getElementById('opp-add-num').focus();` inside `addPlayer`, and `document.getElementById('te-add-num').focus();` inside the Team Editor's `add`. No other line differs.

- [ ] **Step 4: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — neither `addPlayer` nor the Team Editor's `add` has existing test coverage (both are DOM-driven, not pure functions), so this confirms nothing else broke.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "Auto-focus number field after adding a player"
```

- [ ] **Step 6: Manual verification (deferred to the user)**

There is no automated test for this (pure UI-interaction behavior, no logic to unit test). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. On Setup, adding an opponent player moves focus back into the "#" field, ready to type the next player's number.
2. In the Team Editor, adding a player moves focus back into its own "#" field the same way.
3. Typing a blank/invalid number and tapping Add still does nothing (no player added, no focus change).
