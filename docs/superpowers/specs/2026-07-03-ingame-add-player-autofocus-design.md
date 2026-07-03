# Auto-Focus Number Field After Adding a Player (In-Game)

## Problem

Cycle 30 added auto-focus-after-add to the Setup screen's opponent roster and the Team Editor's roster. The in-game "+ Add" flow (`addGamePlayerFromForm`, used for both teams during a live game) has the same UX gap: after adding a player, the number field doesn't regain focus, so rapid multi-player entry requires manually clicking back into the field each time.

## Scope

- `app.js`: `addGamePlayerFromForm(team)` focuses its own team's number input (`[data-addnum="${team}"]`) after `commit(...)` re-renders.
- Out of scope: no change to validation (still silently no-ops on a blank/invalid number, per existing behavior), no change to the name field or the "Close" button, no change to the "persist to saved team" logic.

## Approach

Unlike the Setup/Team Editor forms (fixed `id`s), the in-game add-form's inputs are keyed by a `data-addnum`/`data-addname` attribute per team, since either team's form can be open (tracked by the module-level `addOpen` variable). `addGamePlayerFromForm` doesn't reset `addOpen`, so the form for that team stays open across the `commit()`-triggered re-render — the same input (re-created under the same `data-addnum="${team}"` selector) is still present afterward, so focusing it works the same way as the other two fixes.

Current:
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

Becomes:
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

The `isNaN(num)` guard means focus only moves when a player was actually added, matching the two existing fixes.

## Testing

Pure UI-interaction behavior — no automated test coverage applies (matches the precedent set by Cycle 30; `addGamePlayerFromForm` is DOM-driven, not a pure function). Manual verification (deferred to the user, since this sandbox has no browser):

1. During a live game, opening a team's "+ Add" form and adding a player moves focus back into that team's "#" field, ready to type the next player's number.
2. This works independently for both "my" team and "opp" team's add-forms.
3. Typing a blank/invalid number and tapping Add still does nothing (no player added, no focus change).
