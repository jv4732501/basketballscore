# Team Roster Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "+ Add Team" button on the Teams tab, and make Setup read-only with respect to a team's permanent roster — it only selects a team and lets you check/uncheck who's active for this specific game, never writing back to `state.teams`.

**Architecture:** Two tasks. Task 1 (Teams tab) is fully independent: adds the "+ Add Team" button and fixes the Team Editor's Save logic to handle brand-new teams. Task 2 (Setup screen) must land as one unit — `defaultDraft`, `renderSetup`, the new `renderActiveRoster`, `wireSetup`, `addPlayer`, and `startGame` are tightly coupled (removing fields from the draft in isolation would leave `startGame` referencing fields that no longer exist), so they cannot be split across tasks without an intermediate broken state.

**Tech Stack:** Vanilla JS (`app.js`), no build step, no new CSS needed (reuses existing `.roster`/`.list`/`.listrow` styles).

## Global Constraints

- The Opponent section of Setup (name, roster, add-player) is completely unchanged.
- `state.teams` must never be written by `startGame()` after this change — only the Team Editor writes to it.
- `renderRoster` (used elsewhere by the Team Editor) is not modified by this plan.
- `newGame()` itself is not modified — it already maps whatever player array it's given into fresh objects with zeroed stats, so no extra `clone()` is needed when passing a filtered player array into it.

---

### Task 1: "+ Add Team" button + Team Editor Save fix

**Files:**
- Modify: `app.js:887-929` (`renderTeams`'s non-editor branch), `app.js:982-995` (`renderTeamEditor`'s `#te-save` handler)

**Interfaces:** N/A — this task is independent of Task 2; nothing here is consumed by it.

- [ ] **Step 1: Add the "+ Add Team" button**

In `app.js`, find:

```js
  el.innerHTML = `<h1>Teams</h1><ul class="list">${rows}</ul>`;

  el_each(
    '[data-edit-team]',
```

Replace with:

```js
  el.innerHTML = `<h1>Teams</h1><button id="btn-add-team">+ Add Team</button><ul class="list">${rows}</ul>`;

  document.getElementById('btn-add-team').onclick = () => {
    teamEdit = { id: makeLocalId(), name: '', players: [] };
    renderTeams();
  };

  el_each(
    '[data-edit-team]',
```

- [ ] **Step 2: Fix the Team Editor's Save logic to handle a brand-new team**

In `app.js`, find:

```js
  $('te-save').onclick = () => {
    if (!d.name.trim()) {
      $('te-error').textContent = 'Enter a team name.';
      return;
    }
    const t = state.teams.find((x) => x.id === d.id);
    if (t) {
      t.name = d.name.trim();
      t.players = clone(d.players);
    }
    saveTeams();
    teamEdit = null;
    renderTeams();
  };
```

Replace with:

```js
  $('te-save').onclick = () => {
    if (!d.name.trim()) {
      $('te-error').textContent = 'Enter a team name.';
      return;
    }
    const t = state.teams.find((x) => x.id === d.id);
    if (t) {
      t.name = d.name.trim();
      t.players = clone(d.players);
    } else {
      state.teams.push({ id: d.id, name: d.name.trim(), players: clone(d.players) });
    }
    saveTeams();
    teamEdit = null;
    renderTeams();
  };
```

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — this task adds no new pure-function logic, count must match the current baseline.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "Add Add Team button; fix Team Editor Save to handle brand-new teams"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (pure UI wiring, no logic). Since this sandbox has no browser, ask the user to verify:

1. Teams tab shows a "+ Add Team" button above the team list.
2. Tapping it opens an empty Team Editor (blank name, no players).
3. Naming it, adding a player or two, and tapping Save adds it as a new team, visible in the list immediately.
4. Reloading the page shows the new team persisted.
5. Cancel on a brand-new team discards it (does not appear in the list).
6. Editing/deleting an existing team still works exactly as before.

---

### Task 2: Setup screen — dropdown + per-game active roster, `startGame` no longer touches `state.teams`

**Files:**
- Modify: `app.js:635-648` (`defaultDraft`), `app.js:672-695` (`renderSetup`'s "My Team" card and tip-off button label), `app.js:749` area (add new `renderActiveRoster` function near `renderRoster`), `app.js:795-834` (`wireSetup`'s my-team-select, new-team-name, my-add-*, and `[data-rm]` wiring), `app.js:879-885` (`addPlayer`), `app.js:1053-1101` (`startGame`)

**Interfaces:**
- Produces: `renderActiveRoster(d)` — takes the setup draft, returns HTML for the selected team's roster as a checkbox list. `d.activePlayerIds` — array of player ids currently checked (available for this game).

- [ ] **Step 1: Update `defaultDraft`**

Find:

```js
function defaultDraft() {
  return {
    myTeamId: state.teams[0]?.id ?? null,
    newTeam: state.teams.length === 0, // first run forces "new team"
    newTeamName: '',
    myPlayers: state.teams[0] ? clone(state.teams[0].players) : [],
    oppName: '',
    oppPlayers: [],
    halfLengthMin: 18,
    numHalves: 2,
    otLengthMin: 4,
    myTeamSide: 'home',
  };
}
```

Replace with:

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

- [ ] **Step 2: Update `renderSetup`'s "My Team" card**

Find:

```js
    <section class="card">
      <h2>My Team</h2>
      ${
        state.teams.length
          ? `
        <label>Saved team
          <select id="my-team-select">
            <option value="__new">+ New team</option>
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId && !d.newTeam ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>`
          : ''
      }
      ${d.newTeam ? `<label>Team name <input id="new-team-name" value="${esc(d.newTeamName)}" placeholder="e.g. Lakers"></label>` : ''}
      <div id="my-players">${renderRoster(d.myPlayers, 'my')}</div>
      <div class="add-player">
        <input id="my-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="my-add-name" placeholder="Name (optional)">
        <button id="my-add-btn">Add</button>
      </div>
    </section>
```

Replace with:

```js
    <section class="card">
      <h2>My Team</h2>
      ${
        state.teams.length
          ? `
        <label>Saved team
          <select id="my-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>
        <ul class="roster">${renderActiveRoster(d)}</ul>`
          : `<p class="muted">No teams yet — create one from the Teams tab.</p>`
      }
    </section>
```

- [ ] **Step 3: Update the tip-off button's label**

Find:

```js
        <button class="tip" data-tip="my">${esc(d.newTeam ? d.newTeamName || 'My Team' : currentMyTeamName(d) || 'My Team')}</button>
```

Replace with:

```js
        <button class="tip" data-tip="my">${esc(currentMyTeamName(d) || 'My Team')}</button>
```

- [ ] **Step 4: Add `renderActiveRoster`**

In `app.js`, find:

```js
function renderRoster(players, which) {
```

Add the new function immediately **before** it:

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

function renderRoster(players, which) {
```

- [ ] **Step 5: Update `wireSetup`'s `my-team-select` handler**

Find:

```js
  const sel = $('my-team-select');
  if (sel)
    sel.onchange = () => {
      if (sel.value === '__new') {
        d.newTeam = true;
        d.myTeamId = null;
        d.myPlayers = [];
      } else {
        d.newTeam = false;
        d.myTeamId = sel.value;
        d.myPlayers = clone(state.teams.find((t) => t.id === sel.value).players);
      }
      renderSetup();
    };
  $('new-team-name') &&
    ($('new-team-name').oninput = (e) => {
      d.newTeamName = e.target.value;
    });
```

Replace with:

```js
  const sel = $('my-team-select');
  if (sel)
    sel.onchange = () => {
      d.myTeamId = sel.value;
      const t = state.teams.find((x) => x.id === sel.value);
      d.activePlayerIds = t ? t.players.map((p) => p.id) : [];
      renderSetup();
    };
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

- [ ] **Step 6: Remove the `my-add-btn`/`my-add-num` wiring**

Find:

```js
  $('my-add-btn').onclick = () => addPlayer('my', $('my-add-num'), $('my-add-name'));
  $('opp-add-btn').onclick = () => addPlayer('opp', $('opp-add-num'), $('opp-add-name'));
  $('my-add-num').onkeydown = (e) => {
    if (e.key === 'Enter') $('my-add-btn').click();
  };
  $('opp-add-num').onkeydown = (e) => {
    if (e.key === 'Enter') $('opp-add-btn').click();
  };
```

Replace with:

```js
  $('opp-add-btn').onclick = () => addPlayer($('opp-add-num'), $('opp-add-name'));
  $('opp-add-num').onkeydown = (e) => {
    if (e.key === 'Enter') $('opp-add-btn').click();
  };
```

(The `my-add-btn`/`my-add-num` elements no longer exist in the markup after Step 2, so their wiring must be removed here too — leaving it would throw, since these specific lines call `.onclick =`/`.onkeydown =` directly on the result of `$(...)` without the `$('x') && (...)` null-guard pattern used elsewhere.)

- [ ] **Step 7: Simplify the `[data-rm]` handler to only handle the opponent roster**

Find:

```js
  el_each(
    '[data-rm]',
    (b) =>
      (b.onclick = () => {
        const [which, i] = b.dataset.rm.split(':');
        (which === 'my' ? d.myPlayers : d.oppPlayers).splice(parseInt(i, 10), 1);
        renderSetup();
      }),
  );
```

Replace with:

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

- [ ] **Step 8: Simplify `addPlayer`**

Find:

```js
function addPlayer(which, numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  const list = which === 'my' ? setupDraft.myPlayers : setupDraft.oppPlayers;
  list.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
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
}
```

- [ ] **Step 9: Update `startGame`**

Find:

```js
function startGame(tipWinner, startClock = true) {
  const d = setupDraft;
  const err = document.getElementById('setup-error');
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
    config: {
      halfLengthMin: d.halfLengthMin,
      numHalves: d.numHalves,
      otLengthMin: d.otLengthMin,
      myTeamSide: d.myTeamSide,
    },
    myTeam: { id: myTeamId, name: myName, players: d.myPlayers },
    oppTeam: { name: d.oppName.trim(), players: d.oppPlayers },
  });
```

Replace with:

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
    err.textContent = 'Enter the opponent name.';
    return;
  }
  const activePlayers = myTeam.players.filter((p) => d.activePlayerIds.includes(p.id));
  if (!activePlayers.length) {
    err.textContent = 'Select at least one active player.';
    return;
  }

  let g = newGame({
    config: {
      halfLengthMin: d.halfLengthMin,
      numHalves: d.numHalves,
      otLengthMin: d.otLengthMin,
      myTeamSide: d.myTeamSide,
    },
    myTeam: { id: myTeam.id, name: myTeam.name, players: activePlayers },
    oppTeam: { name: d.oppName.trim(), players: d.oppPlayers },
  });
```

The rest of `startGame` (from `g.id = makeLocalId();` through the end of the function) is unchanged.

- [ ] **Step 10: Verify scope**

Run: `git diff app.js`
Expected: exactly the changes described in Steps 1-9 above — `defaultDraft`, `renderSetup`'s My Team card and tip-off label, the new `renderActiveRoster`, `wireSetup`'s select/checkbox/rm wiring, `addPlayer`, and `startGame`. No other function differs. Confirm Task 1's `renderTeams`/`#te-save` changes (already committed) are not re-touched.

- [ ] **Step 11: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — `startGame` is not a unit-tested pure function (it directly manipulates `state`/DOM), so this task adds no new tests; the count must match the baseline left by Task 1.

- [ ] **Step 12: Commit**

```bash
git add app.js
git commit -m "Make Setup read-only for team rosters; add per-game active-player checklist"
```

- [ ] **Step 13: Manual verification (deferred to the user)**

There is no automated test for this (UI/wiring/game-start logic with no pure-function equivalent — `startGame` itself has no existing unit tests to extend). Since this sandbox has no browser, ask the user to verify:

1. Setup's "My Team" card shows only a dropdown and a checklist of that team's players (all checked by default) — no way to add, rename, or permanently remove a player from here.
2. Unchecking a player and starting a game excludes them from that game; reopening the Team Editor for that team afterward shows the full roster unchanged, including the unchecked player.
3. Switching the "Saved team" dropdown resets the checklist to all-checked for the newly selected team.
4. With zero saved teams, Setup shows "No teams yet — create one from the Teams tab" instead of a dropdown.
5. Unchecking every player and attempting to start shows "Select at least one active player."
6. The Opponent section of Setup (name, roster, add-player) behaves exactly as before.
