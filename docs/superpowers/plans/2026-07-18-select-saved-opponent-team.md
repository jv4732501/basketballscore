# Select a Saved Team as the Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Setup screen's opponent name box match against saved teams (via autocomplete) and, on an exact match, auto-load that team's roster the same way "My team" does today — while a freeform, unsaved opponent name still works exactly as it does now. Rename the Setup screen's "Team"/"Opponent" labels to "Team 1"/"Team 2" to reflect that both slots can now hold a saved team. Extend the existing mid-game "write player edits back to the saved team" behavior (today: "My team" only) to also cover a linked Team 2.

**Architecture:** `setupDraft` gains `oppTeamId`/`activeOppPlayerIds`, mirroring the existing `myTeamId`/`activePlayerIds`. An exact-name-match check (case-insensitive, trimmed) against `state.teams` on every keystroke in the Team 2 box sets/clears `oppTeamId`, which switches the rendered roster between a checkbox list (linked) and the existing manual add/remove list (freeform). `game.oppTeam` gains an `id` field mirroring `game.myTeam.id`, which the two existing mid-game write-back call sites key off of (generalized from a `team === 'my'` check to a shared `backingSavedTeamId(team)` helper).

**Tech Stack:** Vanilla JS single file (`app.js`), `node --test` (no framework), Prettier via `npx` (no install).

**Spec:** `docs/superpowers/specs/2026-07-18-select-saved-opponent-team-design.md`

## Global Constraints

- No build step, no dependencies, no `package.json` — nothing gets installed.
- Anything tests reach must be added to the `module.exports` shim in `app.js` (block starting `// ===== EXPORT SHIM`). Neither task in this plan adds anything to that shim — both tasks touch only DOM/shell code, which this codebase deliberately leaves to manual verification (same precedent as other Setup-screen and dialog wiring).
- After editing `app.js`, run `npx prettier --write app.js` before committing.
- Run the full suite with `node --test` from the repo root after each task; all 78 pre-existing tests must stay green (this plan adds none, since it's shell-only).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Internal code (`myTeam`/`oppTeam` object names, `'my'`/`'opp'` string keys used throughout `app.js`) is NOT renamed — only the three user-facing strings named in the spec change.

---

### Task 1: Setup screen — linking, conditional roster UI, label renames

**Files:**
- Modify: `app.js` — `defaultDraft()` (`app.js:749-760`); `renderSetup()` (`app.js:766-843`, specifically the self-heal check at `app.js:769-772`, the "Team" header at `app.js:795` and `app.js:801`, the `renderActiveRoster(d)` call at `app.js:800`, the opponent card at `app.js:805-813`, and the "My team is" header at `app.js:823`); `renderActiveRoster(d)` (`app.js:851-862`); `wireSetup()` (`app.js:920-1051`, specifically the `[data-active]` wiring at `app.js:991-1002` and the `opp-name` handler at `app.js:1003-1006`).

**Interfaces:**
- Consumes: `state.teams` (existing array of `{ id, name, players: [{id, num, name}] }`); `esc()`, `el_each(selector, fn)` (existing helpers).
- Produces: `setupDraft.oppTeamId` (`string | null`) and `setupDraft.activeOppPlayerIds` (`string[]`) — Task 2's `startGame()` rewrite consumes both. `renderActiveRosterFor(teamId, activeIds, which)` — a generalized replacement for `renderActiveRoster(d)`, used by both Team 1 and (when linked) Team 2.

No unit tests: this is DOM shell/render code, which this codebase deliberately leaves to manual verification (same precedent as the rest of `wireSetup`/`renderSetup`).

- [ ] **Step 1: Add the two new draft fields** — in `app.js`, replace `defaultDraft()` (`app.js:749-760`):

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

- [ ] **Step 2: Add the self-heal check for a deleted linked team** — in `renderSetup()`, directly after the existing `myTeamId` self-heal block (`app.js:769-772`):

```js
  if (!state.teams.some((t) => t.id === d.myTeamId)) {
    d.myTeamId = state.teams[0]?.id ?? null;
    d.activePlayerIds = state.teams[0] ? state.teams[0].players.map((p) => p.id) : [];
  }
  if (d.oppTeamId && !state.teams.some((t) => t.id === d.oppTeamId)) {
    d.oppTeamId = null;
    d.activeOppPlayerIds = [];
  }
```

- [ ] **Step 3: Generalize `renderActiveRoster` into `renderActiveRosterFor`** — replace the whole function (`app.js:851-862`):

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

- [ ] **Step 4: Rename the Team 1 header and switch its roster call** — in `renderSetup()`'s template (`app.js:790-803`), change:

```js
    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>Team</h2>
          <select id="my-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <ul class="roster">${renderActiveRoster(d)}</ul>`
          : `<h2>Team</h2><p class="muted">Create a team on team tab.</p>`
      }
    </section>
```

to:

```js
    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>Team 1</h2>
          <select id="my-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <ul class="roster">${renderActiveRosterFor(d.myTeamId, d.activePlayerIds, 'my')}</ul>`
          : `<h2>Team 1</h2><p class="muted">Create a team on team tab.</p>`
      }
    </section>
```

- [ ] **Step 5: Rename the opponent card to "Team 2" and make its roster conditional** — replace the opponent card block (`app.js:805-813`):

```js
    <section class="card">
      <label class="opp-row">Opponent <input id="opp-name" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
      <div id="opp-players">${renderRoster(d.oppPlayers, 'opp')}</div>
      <div class="add-player">
        <input id="opp-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="opp-add-name" placeholder="Name (optional)">
        <button id="opp-add-btn">Add</button>
      </div>
    </section>
```

with:

```js
    <section class="card">
      <label class="opp-row">Team 2 <input id="opp-name" list="team-names" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
      <datalist id="team-names">
        ${state.teams.map((t) => `<option value="${esc(t.name)}">`).join('')}
      </datalist>
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

- [ ] **Step 6: Rename the home/away toggle header** — in `renderSetup()`'s template (`app.js:822-828`), change `<h2>My team is</h2>` to `<h2>Team 1 is</h2>`.

- [ ] **Step 7: Add the name-matching helper and rewrite the checkbox/name-box wiring** — in `wireSetup()`, replace the `[data-active]` block and the `opp-name` handler (`app.js:991-1006`):

```js
  el_each(
    '[data-active]',
    (cb) =>
      (cb.onchange = () => {
        const id = cb.dataset.active;
        if (cb.checked) {
          if (!d.activePlayerIds.includes(id)) d.activePlayerIds.push(id);
        } else {
          d.activePlayerIds = d.activePlayerIds.filter((x) => x !== id);
        }
      }),
  );
  $('opp-name') &&
    ($('opp-name').oninput = (e) => {
      d.oppName = e.target.value;
    });
```

with:

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

Then add the `findTeamByName` helper directly above `defaultDraft()` (`app.js:749`):

```js
function findTeamByName(name) {
  const norm = name.trim().toLowerCase();
  if (!norm) return null;
  return state.teams.find((t) => t.name.trim().toLowerCase() === norm) ?? null;
}

function defaultDraft() {
```

- [ ] **Step 8: Run the full test suite to verify nothing regressed**

Run: `node --test` → 78 pass (this task adds no unit tests; it must not break any existing ones).

- [ ] **Step 9: Manual verification** (in a browser: `python -m http.server`, open `index.html`, or open the file directly)

1. On Setup, confirm the headers read "Team 1", "Team 2", and "Team 1 is" (home/away toggle).
2. With at least one saved team existing (add one via the Teams tab first if needed), type that team's exact name into the Team 2 box — its roster should appear as a checkbox list (all checked by default), replacing the manual add-player form.
3. Clear the box and type a name that matches no saved team — the manual add-player form and "×"-removable list should reappear, exactly like before this change.
4. Type a saved team's name, then keep typing past the exact match — should fall back to the empty manual list.
5. Link Team 2 to a saved team, then go to the Teams tab and delete that team, then return to Setup — Team 2 should fall back to freeform (empty manual roster) without any error in the console.

- [ ] **Step 10: Format and commit**

```bash
npx prettier --write app.js
node --test
git add app.js
git commit -m "Add ability to link the Team 2 opponent to a saved team

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Game start & mid-game write-back parity

**Files:**
- Modify: `app.js` — `newGame({ config, myTeam, oppTeam })` (`app.js:58-95`, specifically the `oppTeam` object construction at `app.js:72-80`); `startGame()` (`app.js:1241-1280`); `addGamePlayerFromForm(team)` (`app.js:1747-1763`); `openPlayerEditDialog(team, id)`'s `#pe-save` handler (`app.js:1984-2002`, inside the function spanning `app.js:1971-2004`).

**Interfaces:**
- Consumes: `setupDraft.oppTeamId` / `setupDraft.activeOppPlayerIds` from Task 1 (exact field names above); existing `state.teams`, `saveTeams()`, `commit(producer)`, `addPlayerToGame(game, team, player)`, `editPlayer(game, team, id, patch)`.
- Produces: `game.oppTeam.id` (`string | undefined`) — mirrors the existing `game.myTeam.id`, `undefined` for a freeform opponent. `backingSavedTeamId(team)` — a new helper both write-back call sites use.

No unit tests: this task changes `startGame()` (DOM-error-message-driven, no return value tests exist for it today) and two dialog click handlers — all DOM shell code per this codebase's existing convention.

- [ ] **Step 1: Pass `oppTeam.id` through in `newGame`** — in `app.js`, change the `oppTeam` object inside `newGame()` (`app.js:72-80`) from:

```js
    oppTeam: {
      name: oppTeam.name,
      players: oppTeam.players.map((p) => ({
        id: p.id,
        num: p.num,
        name: p.name,
        ...emptyMyStats(),
      })),
    },
```

to:

```js
    oppTeam: {
      id: oppTeam.id,
      name: oppTeam.name,
      players: oppTeam.players.map((p) => ({
        id: p.id,
        num: p.num,
        name: p.name,
        ...emptyMyStats(),
      })),
    },
```

- [ ] **Step 2: Resolve the opponent roster from the linked team (or freeform) in `startGame`** — replace the whole function (`app.js:1241-1280`):

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
    config: {
      halfLengthMin: d.halfLengthMin,
      numHalves: d.numHalves,
      otLengthMin: d.otLengthMin,
      myTeamSide: d.myTeamSide,
    },
    myTeam: { id: myTeam.id, name: myTeam.name, players: activePlayers },
    oppTeam: { id: oppTeamId, name: d.oppName.trim(), players: oppPlayers },
  });
  g.id = makeLocalId();
  g.date = Date.now();
  g = setPossession(g, tipWinner);
  if (startClock) g = toggleClock(g, Date.now()); // tip-off starts the clock (Start button leaves it stopped)
  state.game = g;
  setupDraft = null;
  addOpen = null;
  missArm = false;
  missLock = false;
  saveGame();
  render();
}
```

- [ ] **Step 3: Add the `backingSavedTeamId` helper** — in `app.js`, directly above `addGamePlayerFromForm` (`app.js:1747`):

```js
function backingSavedTeamId(team) {
  return team === 'my' ? state.game.myTeam.id : state.game.oppTeam.id;
}

function addGamePlayerFromForm(team) {
```

- [ ] **Step 4: Generalize the mid-game "add player" write-back** — replace the body of `addGamePlayerFromForm` (`app.js:1747-1763`):

```js
function addGamePlayerFromForm(team) {
  const numEl = document.querySelector(`[data-addnum="${team}"]`);
  const nameEl = document.querySelector(`[data-addname="${team}"]`);
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return; // blank/non-numeric jersey → no-op
  const player = { id: makeLocalId(), num, name: nameEl.value.trim() };
  commit((game) => addPlayerToGame(game, team, player)); // mutate → save → render
  const savedId = backingSavedTeamId(team);
  if (savedId) {
    // persist to the saved team
    const t = state.teams.find((x) => x.id === savedId);
    if (t) {
      t.players.push({ id: player.id, num: player.num, name: player.name });
      saveTeams();
    }
  }
  document.querySelector(`[data-addnum="${team}"]`).focus();
}
```

- [ ] **Step 5: Generalize the mid-game "edit player" write-back** — in `openPlayerEditDialog`, replace the `#pe-save` handler (`app.js:1984-2002`):

```js
  dlg.querySelector('#pe-save').onclick = () => {
    const num = parseInt(dlg.querySelector('#pe-num').value, 10);
    if (isNaN(num)) {
      dlg.querySelector('#pe-error').textContent = 'Enter a jersey number.';
      return;
    }
    const name = dlg.querySelector('#pe-name').value.trim();
    commit((game) => editPlayer(game, team, id, { num, name }));
    if (team === 'my') {
      const st = state.teams.find((x) => x.id === state.game.myTeam.id);
      const sp = st && st.players.find((x) => x.id === id);
      if (sp) {
        sp.num = num;
        sp.name = name;
        saveTeams();
      }
    }
    closeActivityDialog();
  };
```

with:

```js
  dlg.querySelector('#pe-save').onclick = () => {
    const num = parseInt(dlg.querySelector('#pe-num').value, 10);
    if (isNaN(num)) {
      dlg.querySelector('#pe-error').textContent = 'Enter a jersey number.';
      return;
    }
    const name = dlg.querySelector('#pe-name').value.trim();
    commit((game) => editPlayer(game, team, id, { num, name }));
    const savedId = backingSavedTeamId(team);
    if (savedId) {
      const st = state.teams.find((x) => x.id === savedId);
      const sp = st && st.players.find((x) => x.id === id);
      if (sp) {
        sp.num = num;
        sp.name = name;
        saveTeams();
      }
    }
    closeActivityDialog();
  };
```

Note: `backingSavedTeamId` reads `state.game.myTeam.id` / `state.game.oppTeam.id` at call time, same as the original code did for `'my'` — this must run after `commit()` has updated `state.game`, same ordering as the original.

- [ ] **Step 6: Run the full test suite to verify nothing regressed**

Run: `node --test` → 78 pass.

- [ ] **Step 7: Manual verification** (in a browser)

1. On Setup, link Team 2 to a saved team (per Task 1's verification), uncheck one of its players, then Start — confirm the unchecked player does not appear in-game.
2. Mid-game, open a Team 2 player's long-press menu → Activity → use the number pad / add-player flow to add a new player to Team 2 (or edit an existing one's number/name) — after saving, go to the Teams tab and confirm that saved team's roster reflects the addition/edit.
3. Start a new game with a freeform (unmatched-name) Team 2, add/edit a player mid-game — confirm no entry appears on the Teams tab (no saved team was created or modified).
4. Confirm "My team"/Team 1 mid-game add/edit write-back still works exactly as before (unaffected by this change).

- [ ] **Step 8: Format and commit**

```bash
npx prettier --write app.js
node --test
git add app.js
git commit -m "Sync a linked Team 2 opponent's roster on mid-game add/edit

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual verification (user, after both tasks)

1. Repeat Task 1 Step 9 and Task 2 Step 7's checks end-to-end in one sitting: create a saved team via the Teams tab if you don't have one, use it as Team 2 for a game, confirm roster loading, active-player filtering, mid-game roster sync back to Teams, and that a plain typed (unsaved) opponent name still behaves exactly as before this change.
2. Confirm the "Team 1"/"Team 2"/"Team 1 is Home/Away" labels read clearly in both light and dark themes.
