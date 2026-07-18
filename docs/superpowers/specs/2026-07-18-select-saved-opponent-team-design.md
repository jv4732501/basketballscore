# Select a Saved Team as the Opponent

## Problem

Today, "My team" on the Setup screen is picked from a dropdown of saved
teams (`state.teams`), and its roster (with active/inactive checkboxes)
loads automatically. The opponent, by contrast, is always freeform: a
plain text name plus a per-game, hand-typed roster that's thrown away
after the game — even if you play the same opponent repeatedly.

## Goal

Let the opponent name box match against saved teams (via a native
autocomplete list) and, on an exact match, auto-load that team's roster
the same way "My team" does — while still allowing a fully freeform,
unsaved opponent name for one-off games. Once this exists, "My team" vs
"Opponent" is a less accurate distinction (both slots can now hold a
saved team), so the Setup screen picker labels become "Team 1" / "Team
2". Internal code (`myTeam`/`oppTeam`, `'my'`/`'opp'` keys) is untouched
— this is a label-only change, not an architecture rename.

## Data model

`setupDraft` gains two fields, mirroring the existing "my team" ones:

- `oppTeamId: string | null` — id of a saved team the opponent is
  currently linked to, or `null` for a freeform/unsaved opponent.
- `activeOppPlayerIds: string[]` — active-player selection, used only
  when `oppTeamId` is set (mirrors `activePlayerIds`).

`oppPlayers` (existing field) is now used only when `oppTeamId` is
`null` — the manual add/remove roster for freeform opponents.

`defaultDraft()` adds the two new fields:

```js
function defaultDraft() {
  return {
    myTeamId: state.teams[0]?.id ?? null,
    activePlayerIds: state.teams[0] ? state.teams[0].players.map((p) => p.id) : [],
    oppTeamId: null,
    activeOppPlayerIds: [],
    oppName: '',
    oppPlayers: [],
    halfLengthMin: 18,
    numHalves: 2,
    otLengthMin: 4,
    myTeamSide: 'home',
  };
}
```

`game.oppTeam` gains an `id` field, mirroring `game.myTeam.id` (already
present). `undefined` for freeform opponents; set to the saved team's id
when linked. This is what mid-game write-back (see below) keys off.

## Matching logic (linking on exact name match)

On every keystroke in the Team 2 name box, compare the trimmed,
case-insensitive text against saved team names:

```js
function findTeamByName(name) {
  const norm = name.trim().toLowerCase();
  if (!norm) return null;
  return state.teams.find((t) => t.name.trim().toLowerCase() === norm) ?? null;
}
```

Wired in `wireSetup()`, replacing the current plain `oninput` on
`opp-name`:

```js
$('opp-name') &&
  ($('opp-name').oninput = (e) => {
    d.oppName = e.target.value;
    const match = findTeamByName(d.oppName);
    if (match) {
      d.oppTeamId = match.id;
      d.activeOppPlayerIds = match.players.map((p) => p.id);
    } else if (d.oppTeamId !== null) {
      d.oppTeamId = null;
      d.activeOppPlayerIds = [];
      d.oppPlayers = [];
    }
    renderSetup();
  });
```

(Re-rendering on every keystroke is necessary because the roster block
below the name box switches between two different UIs depending on
`oppTeamId` — same reason `my-team-select`'s `onchange` already calls
`renderSetup()`.)

A native `<datalist>` gives autocomplete suggestions without hiding the
freeform option:

```html
<datalist id="team-names">
  ${state.teams.map((t) => `<option value="${esc(t.name)}">`).join('')}
</datalist>
```

attached via `list="team-names"` on `#opp-name`.

## Setup screen UI

Section header changes (the only three literal "My team"/"Opponent"
strings in the app, confirmed by search — no other screen references
these words):

- `<h2>Team</h2>` (my-team selector card) → `<h2>Team 1</h2>`
- `<label class="opp-row">Opponent ...` → `<label class="opp-row">Team 2 ...`
- `<h2>My team is</h2>` (home/away toggle card) → `<h2>Team 1 is</h2>`
- Error text `'Enter the opponent name.'` → `"Enter Team 2's name."`

The opponent card's roster becomes conditional on `d.oppTeamId`:

```js
<section class="card">
  <label class="opp-row">Team 2 <input id="opp-name" list="team-names"
    value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
  ${
    d.oppTeamId
      ? `<ul class="roster">${renderActiveRosterFor(d.oppTeamId, d.activeOppPlayerIds, 'opp')}</ul>`
      : `
    <div id="opp-players">${renderRoster(d.oppPlayers, 'opp')}</div>
    <div class="add-player">
      <input id="opp-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
      <input id="opp-add-name" placeholder="Name (optional)">
      <button id="opp-add-btn">Add</button>
    </div>`
  }
</section>
```

`renderActiveRoster(d)` is generalized to take explicit params so both
Team 1 and a linked Team 2 can use it:

```js
function renderActiveRosterFor(teamId, activeIds, which) {
  const t = state.teams.find((x) => x.id === teamId);
  if (!t || !t.players.length) return `<p class="muted">No players on this team yet.</p>`;
  return t.players
    .map(
      (p) => `
    <li>
      <label><input type="checkbox" data-active-${which}="${p.id}" ${activeIds.includes(p.id) ? 'checked' : ''}><span>#${p.num} ${esc(p.name || '')}</span></label>
    </li>`,
    )
    .join('');
}
```

`renderActiveRoster(d)`'s one existing call site becomes
`renderActiveRosterFor(d.myTeamId, d.activePlayerIds, 'my')`.

Checkbox wiring in `wireSetup()` needs a second block for the opponent
variant (the existing `[data-active]` block is renamed
`[data-active-my]` to disambiguate from the new `[data-active-opp]`):

```js
el_each(
  '[data-active-my]',
  (cb) =>
    (cb.onchange = () => {
      const id = cb.dataset.activeMy;
      if (cb.checked) {
        if (!d.activePlayerIds.includes(id)) d.activePlayerIds.push(id);
      } else {
        d.activePlayerIds = d.activePlayerIds.filter((x) => x !== id);
      }
    }),
);
el_each(
  '[data-active-opp]',
  (cb) =>
    (cb.onchange = () => {
      const id = cb.dataset.activeOpp;
      if (cb.checked) {
        if (!d.activeOppPlayerIds.includes(id)) d.activeOppPlayerIds.push(id);
      } else {
        d.activeOppPlayerIds = d.activeOppPlayerIds.filter((x) => x !== id);
      }
    }),
);
```

When `oppTeamId` is set, the add-player mini-form and inline
delete (`data-rm`) are not rendered, so no additional guard is needed
there — editing a linked team's roster happens on the Teams tab, same
as Team 1 today.

## Game start & mid-game write-back parity

`startGame()` builds the opponent roster from the linked team when
`oppTeamId` is set, otherwise from the freeform list (unchanged path):

```js
function startGame(tipWinner, startClock = true) {
  const d = setupDraft;
  const err = document.getElementById('setup-error');
  const myTeam = state.teams.find((t) => t.id === d.myTeamId);
  if (!myTeam) {
    err.textContent = 'Select a team from the Teams tab first.';
    return;
  }
  if (!d.oppName.trim()) {
    err.textContent = "Enter Team 2's name.";
    return;
  }
  const activePlayers = myTeam.players.filter((p) => d.activePlayerIds.includes(p.id));
  if (!activePlayers.length) {
    err.textContent = 'Select at least one active player.';
    return;
  }

  let oppTeamId, oppPlayers;
  const oppSaved = d.oppTeamId ? state.teams.find((t) => t.id === d.oppTeamId) : null;
  if (oppSaved) {
    oppPlayers = oppSaved.players.filter((p) => d.activeOppPlayerIds.includes(p.id));
    if (!oppPlayers.length) {
      err.textContent = 'Select at least one active player for Team 2.';
      return;
    }
    oppTeamId = oppSaved.id;
  } else {
    oppPlayers = d.oppPlayers;
    oppTeamId = undefined;
  }

  let g = newGame({
    config: { /* unchanged */ },
    myTeam: { id: myTeam.id, name: myTeam.name, players: activePlayers },
    oppTeam: { id: oppTeamId, name: d.oppName.trim(), players: oppPlayers },
  });
  // ...unchanged from here
}
```

(If `d.oppTeamId` pointed at a team that was deleted since it was
picked, `oppSaved` is `null` — see Edge cases.)

`newGame()` passes `oppTeam.id` through, mirroring `myTeam.id`:

```js
oppTeam: {
  id: oppTeam.id,
  name: oppTeam.name,
  players: oppTeam.players.map((p) => ({ id: p.id, num: p.num, name: p.name, ...emptyMyStats() })),
},
```

Mid-game write-back (`addGamePlayerFromForm` and the player-edit
dialog's save handler) currently gate on `team === 'my'`. Both are
generalized to resolve which saved team (if any) backs the given game
team:

```js
function backingSavedTeamId(team) {
  return team === 'my' ? state.game.myTeam.id : state.game.oppTeam.id;
}
```

`addGamePlayerFromForm`:

```js
function addGamePlayerFromForm(team) {
  const numEl = document.querySelector(`[data-addnum="${team}"]`);
  const nameEl = document.querySelector(`[data-addname="${team}"]`);
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  const player = { id: makeLocalId(), num, name: nameEl.value.trim() };
  commit((game) => addPlayerToGame(game, team, player));
  const savedId = backingSavedTeamId(team);
  if (savedId) {
    const t = state.teams.find((x) => x.id === savedId);
    if (t) {
      t.players.push({ id: player.id, num: player.num, name: player.name });
      saveTeams();
    }
  }
  document.querySelector(`[data-addnum="${team}"]`).focus();
}
```

Player-edit dialog save handler: same change, `if (team === 'my')` →
`const savedId = backingSavedTeamId(team); if (savedId) { ... }`, using
`savedId` in place of `state.game.myTeam.id`.

Freeform opponents have `state.game.oppTeam.id === undefined`, so
`backingSavedTeamId('opp')` returns falsy and behavior is identical to
today (game-only, no write-back) — no regression for the common
one-off-opponent case.

## Edge cases

- **Saved team deleted after linking, before Start**: `renderSetup()`
  already self-heals `d.myTeamId` on every render if it no longer
  exists in `state.teams`. The same check is added for `d.oppTeamId`:

  ```js
  if (d.oppTeamId && !state.teams.some((t) => t.id === d.oppTeamId)) {
    d.oppTeamId = null;
    d.activeOppPlayerIds = [];
  }
  ```

  This reverts to freeform (empty roster), so Start's existing "select
  at least one active player" validation catches it cleanly rather than
  crashing on a missing team.
- **Saved team's roster edited (via Teams tab) after linking, before
  Start**: `activeOppPlayerIds` is a snapshot taken at match time
  (default: all active). Not live-reactive to later edits — this is the
  same limitation "My team" already has today via `activePlayerIds`,
  not a new gap introduced here.
- **Duplicate saved team names**: `findTeamByName` returns the first
  match (`Array.find`). Not worth extra UI for this unlikely case.
- **Team 1 stays saved-teams-only**: no freeform option added there;
  out of scope.

## Testing

This is entirely Setup-screen shell code plus two small write-back
call-site changes — consistent with this codebase's existing convention
of leaving DOM/shell wiring to manual verification (no unit tests for
`wireSetup`, `renderSetup`, `startGame`'s DOM-facing parts, or the
mid-game add/edit dialogs today).

Manual verification (user):

1. On Setup, type a saved team's exact name into "Team 2" — its roster
   (with checkboxes) should replace the manual add-player UI. Toggle a
   player off, start the game, confirm only active players appear.
2. Type a name that doesn't match any saved team — manual add/remove
   roster UI should be showing, exactly like today.
3. Type a saved team's name, then keep typing past the match (making it
   no longer match) — should fall back to the empty manual roster.
4. Start a game against a linked Team 2, add a player mid-game via the
   player activity dialog — confirm it also appears on that saved
   team's roster afterward (Teams tab). Edit a player's number/name
   mid-game — confirm the saved team updates too.
5. Start a game against a freeform (unmatched) Team 2, add/edit a
   player mid-game — confirm no saved team is created or modified.
6. Link Team 2, then delete that saved team from the Teams tab, return
   to Setup — should fall back to freeform without errors.
7. Confirm the "Team 1" / "Team 2" / "Team 1 is Home/Away" labels read
   correctly in both light and dark themes (no styling change expected,
   just text).

## Out of scope (YAGNI)

- No freeform option for Team 1 (must remain a saved team, as today).
- No live re-sync of a linked roster if it's edited on the Teams tab
  while Setup is still open (matches existing Team 1 behavior).
- No dedup/merge UI for duplicate saved team names.
- No rename of internal `myTeam`/`oppTeam`/`'my'`/`'opp'` architecture —
  label-only change.
