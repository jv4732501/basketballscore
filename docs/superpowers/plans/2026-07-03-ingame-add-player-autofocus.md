# In-Game Add-Player Auto-Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After adding a player via the in-game "+ Add" form (either team), automatically move focus back to that team's "#" input, matching the Setup/Team Editor behavior added in Cycle 30.

**Architecture:** One line added to `addGamePlayerFromForm(team)` in `app.js`.

**Tech Stack:** Vanilla JS (`app.js`), no build step.

## Global Constraints

- No change to validation — a blank/invalid number still silently no-ops (no player added, no focus change), unchanged from today.
- No change to the name field, the "Close" button, or the "persist to saved team" logic.

---

### Task 1: Auto-focus `[data-addnum="${team}"]` after adding an in-game player

**Files:**
- Modify: `app.js` (`addGamePlayerFromForm(team)` function)

**Interfaces:** N/A — this is the only task in the plan; pure behavior addition, nothing here is consumed by other tasks.

- [ ] **Step 1: Add focus call to `addGamePlayerFromForm`**

Find:

```js
function addGamePlayerFromForm(team) {
  const numEl = document.querySelector(`[data-addnum="${team}"]`);
  const nameEl = document.querySelector(`[data-addname="${team}"]`);
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return; // blank/non-numeric jersey → no-op
  const player = { id: makeLocalId(), num, name: nameEl.value.trim() };
  commit((game) => addPlayerToGame(game, team, player)); // mutate → save → render
  if (team === 'my') {
    // persist to the saved team
    const t = state.teams.find((x) => x.id === state.game.myTeam.id);
    if (t) {
      t.players.push({ id: player.id, num: player.num, name: player.name });
      saveTeams();
    }
  }
}
```

Replace with:

```js
function addGamePlayerFromForm(team) {
  const numEl = document.querySelector(`[data-addnum="${team}"]`);
  const nameEl = document.querySelector(`[data-addname="${team}"]`);
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return; // blank/non-numeric jersey → no-op
  const player = { id: makeLocalId(), num, name: nameEl.value.trim() };
  commit((game) => addPlayerToGame(game, team, player)); // mutate → save → render
  if (team === 'my') {
    // persist to the saved team
    const t = state.teams.find((x) => x.id === state.game.myTeam.id);
    if (t) {
      t.players.push({ id: player.id, num: player.num, name: player.name });
      saveTeams();
    }
  }
  document.querySelector(`[data-addnum="${team}"]`).focus();
}
```

- [ ] **Step 2: Verify scope**

Run: `git diff app.js`
Expected: exactly one line added — `document.querySelector(\`[data-addnum="${team}"]\`).focus();` — placed after the `if (team === 'my') { ... }` block, at the end of the function. No other line differs.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — `addGamePlayerFromForm` has no existing test coverage (DOM-driven, not a pure function), so this confirms nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "Auto-focus number field after adding an in-game player"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure UI-interaction behavior, no logic to unit test). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. During a live game, opening a team's "+ Add" form and adding a player moves focus back into that team's "#" field, ready to type the next player's number.
2. This works independently for both "my" team and "opp" team's add-forms.
3. Typing a blank/invalid number and tapping Add still does nothing (no player added, no focus change).
