# Auto-Focus Number Field After Adding a Player

## Problem

Adding a player (opponent roster on Setup, or a team's roster in the Team Editor) re-renders the whole screen, destroying and recreating the add-player form's inputs. The user then has to manually click back into the "#" (jersey number) field to add the next player. For rapid multi-player entry, the number field should regain focus automatically right after a player is added.

## Scope

- `app.js`: `addPlayer(numEl, nameEl)` (opponent roster) and the Team Editor's local `add` function (inside `renderTeamEditor`) both focus their respective "#" input immediately after the re-render that follows adding a player.
- Out of scope: no change to validation (still silently no-ops on a blank/invalid number, per existing behavior), no change to the name field, no change to any other add/remove flow.

## Approach

Since re-rendering (`renderSetup()`/`renderTeams()`) destroys and recreates the DOM synchronously before returning, focusing the new element right after that call works reliably — the new input already exists by then.

### `addPlayer` (opponent roster)

Current:
```js
function addPlayer(numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  setupDraft.oppPlayers.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
}
```

Becomes:
```js
function addPlayer(numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  setupDraft.oppPlayers.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
  document.getElementById('opp-add-num').focus();
}
```

### Team Editor's `add` (inside `renderTeamEditor`)

Current:
```js
  const add = () => {
    const num = parseInt($('te-add-num').value, 10);
    if (isNaN(num)) return;
    d.players.push({ id: makeLocalId(), num, name: $('te-add-name').value.trim() });
    renderTeams();
  };
```

Becomes:
```js
  const add = () => {
    const num = parseInt($('te-add-num').value, 10);
    if (isNaN(num)) return;
    d.players.push({ id: makeLocalId(), num, name: $('te-add-name').value.trim() });
    renderTeams();
    document.getElementById('te-add-num').focus();
  };
```

In both cases, the `isNaN(num)` guard means focus only moves when a player was actually added — a blank/invalid number still silently no-ops, unchanged from today.

## Testing

Pure UI-interaction behavior — no automated test coverage applies (matches the precedent set by prior interaction-only changes; neither `addPlayer` nor the Team Editor's `add` are pure functions with existing test coverage). Manual verification (deferred to the user, since this sandbox has no browser):

1. On Setup, adding an opponent player moves focus back into the "#" field, ready to type the next player's number.
2. In the Team Editor, adding a player moves focus back into its own "#" field the same way.
3. Typing a blank/invalid number and tapping Add still does nothing (no player added, no focus change).
