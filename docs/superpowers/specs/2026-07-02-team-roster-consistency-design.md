# Team Roster Consistency: Add Team Button, Setup Simplification, Per-Game Active Roster

## Problem

Today, a saved team's roster can be silently overwritten by the Setup screen: picking an existing team for "My Team" copies its roster into a draft (`setupDraft.myPlayers`), which can be edited (add/remove players) right there on Setup, and `startGame()` writes that draft back over the saved team's actual roster the moment the game starts. This means:
- Removing a player with `×` on Setup doesn't visibly do anything until you start the game — the team's real roster is untouched until that moment, which is confusing (the user reported "I can click the X to remove a player from the game, but they are still on the team").
- There's no way to sit a player out for one game (injury, illness) without that decision propagating into the team's permanent roster.
- Team creation only happens as a side effect of starting a game, with no direct "create a team" entry point on the Teams tab, unlike every other team-management action (which now live in the Team Editor after Cycle 22).

This change makes the Team Editor the single place a team's actual roster (names, numbers, membership) is ever edited. Setup becomes read-only with respect to the team's permanent roster — it only lets you pick a team and choose who's active *for this game*, which never touches `state.teams`.

## Scope

- `app.js`:
  - **Add Team button** (Teams tab, non-editor list view): opens the existing Team Editor with an empty draft.
  - **Team Editor Save fix**: currently only updates a team found by id; for a new team (not yet in `state.teams`) it silently does nothing. Fixed to push a new team when not found.
  - **Setup "My Team" simplification**: dropdown-only team selection; no new-team creation, no roster add/remove, no roster editing UI.
  - **New per-game active-roster checklist**: shows the selected team's current roster (read-only names/numbers) with a checkbox per player, all checked by default; unchecking excludes that player from this game only.
  - **`startGame()`**: builds the game's `myTeam.players` from only the checked players; no longer writes anything back to `state.teams`.
  - Minor cleanup: `addPlayer()`'s now-unreachable `'my'` branch is removed (only `'opp'` ever calls it going forward), and `currentMyTeamName`'s caller no longer branches on a `newTeam` flag that no longer exists.
- Out of scope: the Opponent section of Setup (name, roster, add-player) is completely unchanged — opponents have no persistent roster anywhere in this app. `renderRoster` (used by the Team Editor and, unaffected, nowhere else after this change) is not modified.

## Approach

### 1. "Add Team" button (Teams tab)

In `renderTeams()`'s non-editor branch, add a button near the top of the team list (e.g. right after the `<h1>Teams</h1>` heading, before the `<ul class="list">`):
```html
<button id="btn-add-team">+ Add Team</button>
```
Wired as:
```js
document.getElementById('btn-add-team').onclick = () => {
  teamEdit = { id: makeLocalId(), name: '', players: [] };
  renderTeams();
};
```
Since `teamEdit` becomes truthy, `renderTeams()` immediately routes to `renderTeamEditor`, reusing 100% of the existing name/roster/add-player/Save/Cancel machinery with an empty starting draft.

### 2. Team Editor Save fix (new team vs. existing team)

Current `$('te-save').onclick`:
```js
const t = state.teams.find((x) => x.id === d.id);
if (t) {
  t.name = d.name.trim();
  t.players = clone(d.players);
}
saveTeams();
```
Becomes:
```js
const t = state.teams.find((x) => x.id === d.id);
if (t) {
  t.name = d.name.trim();
  t.players = clone(d.players);
} else {
  state.teams.push({ id: d.id, name: d.name.trim(), players: clone(d.players) });
}
saveTeams();
```

### 3. Setup "My Team": dropdown + active-roster checklist

`defaultDraft()` drops `newTeam`/`newTeamName`/`myPlayers`, adds `activePlayerIds`:
```js
function defaultDraft() {
  return {
    myTeamId: state.teams[0]?.id ?? null,
    activePlayerIds: state.teams[0] ? state.teams[0].players.map((p) => p.id) : [],
    oppName: '',
    oppPlayers: [],
    halfLengthMin: 18,
    numHalves: 2,
    otLengthMin: 4,
    myTeamSide: 'home',
  };
}
```

`renderSetup()`'s "My Team" card:
```html
<section class="card">
  <h2>My Team</h2>
  ${
    state.teams.length
      ? `<label>Saved team
          <select id="my-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>
        <ul class="roster">${renderActiveRoster(d)}</ul>`
      : `<p class="muted">No teams yet — create one from the Teams tab.</p>`
  }
</section>
```

New function, placed near `renderRoster`:
```js
function renderActiveRoster(d) {
  const t = state.teams.find((x) => x.id === d.myTeamId);
  if (!t || !t.players.length) return `<p class="muted">No players on this team yet.</p>`;
  return t.players
    .map(
      (p) => `
    <li>
      <label><input type="checkbox" data-active="${p.id}" ${d.activePlayerIds.includes(p.id) ? 'checked' : ''}> #${p.num} ${esc(p.name || '')}</label>
    </li>`,
    )
    .join('');
}
```

`wireSetup()`'s `my-team-select` handler resets the checklist to all-checked for the newly selected team:
```js
const sel = $('my-team-select');
if (sel)
  sel.onchange = () => {
    d.myTeamId = sel.value;
    const t = state.teams.find((x) => x.id === sel.value);
    d.activePlayerIds = t ? t.players.map((p) => p.id) : [];
    renderSetup();
  };
```

New checkbox wiring:
```js
el_each('[data-active]', (cb) =>
  (cb.onchange = () => {
    const id = cb.dataset.active;
    if (cb.checked) {
      if (!d.activePlayerIds.includes(id)) d.activePlayerIds.push(id);
    } else {
      d.activePlayerIds = d.activePlayerIds.filter((x) => x !== id);
    }
  }),
);
```

Removed entirely from `wireSetup()`: the `__new`/`newTeam` branch of the select's old `onchange`, the `new-team-name` input wiring, and the `my-add-btn`/`my-add-num` wiring (their markup no longer exists — leaving stale wiring code that calls `.onclick =`/`.onkeydown =` on a now-nonexistent element would throw, since those specific lines don't use the `$('x') && (...)` null-guard pattern that other optional elements use).

The shared `[data-rm]` handler in `wireSetup()` (currently branching `which === 'my' ? d.myPlayers : d.oppPlayers`) is simplified to only handle `'opp'`, since `'my'` rows are never rendered anymore:
```js
el_each(
  '[data-rm]',
  (b) =>
    (b.onclick = () => {
      const [, i] = b.dataset.rm.split(':');
      d.oppPlayers.splice(parseInt(i, 10), 1);
      renderSetup();
    }),
);
```

`addPlayer()` drops its now-unreachable `'my'` branch and its `which` parameter, since only the opponent add-player form calls it going forward:
```js
function addPlayer(numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  setupDraft.oppPlayers.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
}
```
Its one remaining call site updates to `addPlayer($('opp-add-num'), $('opp-add-name'))`.

The tip-off button's label simplifies (drops the `d.newTeam` branch that no longer exists):
```js
${esc(currentMyTeamName(d) || 'My Team')}
```

### 4. `startGame()`: read-only with respect to `state.teams`, filters to active players

Current (relevant portion):
```js
const myName = d.newTeam ? d.newTeamName.trim() : currentMyTeamName(d);
if (!myName) {
  err.textContent = 'Enter your team name.';
  return;
}
if (!d.oppName.trim()) {
  err.textContent = 'Enter the opponent name.';
  return;
}

// Persist a new team to saved teams (or update the selected one)
let myTeamId = d.myTeamId;
if (d.newTeam) {
  myTeamId = makeLocalId();
  state.teams.push({ id: myTeamId, name: myName, players: clone(d.myPlayers) });
} else {
  const t = state.teams.find((x) => x.id === myTeamId);
  if (t) {
    t.name = myName;
    t.players = clone(d.myPlayers);
  }
}
saveTeams();

let g = newGame({
  config: { ... },
  myTeam: { id: myTeamId, name: myName, players: d.myPlayers },
  oppTeam: { name: d.oppName.trim(), players: d.oppPlayers },
});
```

Becomes:
```js
const myTeam = state.teams.find((t) => t.id === d.myTeamId);
if (!myTeam) {
  err.textContent = 'Select a team from the Teams tab first.';
  return;
}
if (!d.oppName.trim()) {
  err.textContent = 'Enter the opponent name.';
  return;
}
const activePlayers = myTeam.players.filter((p) => d.activePlayerIds.includes(p.id));
if (!activePlayers.length) {
  err.textContent = 'Select at least one active player.';
  return;
}

let g = newGame({
  config: { ... },
  myTeam: { id: myTeam.id, name: myTeam.name, players: activePlayers },
  oppTeam: { name: d.oppName.trim(), players: d.oppPlayers },
});
```

`state.teams` is never written by `startGame()` anymore — the "Persist a new team..." block and its `saveTeams()` call are removed entirely. `newGame()` itself already maps `myTeam.players` into brand-new player objects (id/num/name plus fresh zeroed stats via `emptyMyStats()`), so passing the filtered array directly (no extra clone needed) is safe — this matches how the original code already passed `d.myPlayers` directly without an outer clone.

## Testing

All of this is UI/wiring/markup — the only game-logic function touched is `startGame()`, and it isn't a pure function exported for testing (it directly manipulates `state`/DOM), matching the existing precedent that `startGame` has no unit test coverage today. No automated test applies. Manual verification (deferred to the user, since this sandbox has no browser):

1. Teams tab shows a "+ Add Team" button; tapping it opens an empty Team Editor. Naming it and adding players, then Save, adds it as a new team to the list (visible immediately, persists after reload).
2. Setup's "My Team" card shows only a dropdown and a checklist of that team's players (all checked by default) — no way to add, rename, or permanently remove a player from here.
3. Unchecking a player and starting a game excludes them from that game's box score/controls; reopening the Team Editor for that team afterward shows their full roster unchanged (including the unchecked player).
4. Switching the "Saved team" dropdown resets the checklist to all-checked for the newly selected team.
5. Starting a game with zero teams shows "No teams yet — create one from the Teams tab" instead of a dropdown, and Start (if reachable) shows "Select a team from the Teams tab first."
6. Unchecking every player and attempting to start shows "Select at least one active player."
7. The Opponent section of Setup (name, roster, add-player) behaves exactly as before.
8. Editing/deleting a team's roster from the Team Editor (Cycle 21/22 features) is unaffected.
