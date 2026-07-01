# Home Navigation, Teams & Game Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a home tab bar (New Game · Teams · History), a Teams management page (edit/delete), and a Game history page (save finished games, re-open to keep scoring, delete).

**Architecture:** Incremental change to the existing single-file scorer (`app.js` pure-logic + shell, `index.html`, `styles.css`, `logic.test.js`). New pure history functions are TDD'd with `node --test`; the navigation, pages, and persistence are shell, verified by a Node load-check + manual browser QA. Tasks are ordered so each leaves the app in a working state.

**Tech Stack:** Vanilla JS (ES2020+), HTML, CSS. Node's built-in `node --test` (no `npm install`).

## Global Constraints

- **No runtime dependencies, no build step, no network.** App is `index.html` + `styles.css` + `app.js`.
- **`app.js` must stay `require()`-able in Node with no DOM** — no top-level `document`/`window`/`localStorage`; only the `DOMContentLoaded` bootstrap under `if (typeof document !== 'undefined')`. Verify after every task with `node -e "require('./app.js'); console.log('loads OK')"`.
- **Pure-logic functions are deterministic and side-effect-free:** all inputs as arguments, no `Date.now()` in logic, `structuredClone` via `clone()`, never mutate inputs.
- **Per-team state keyed by identity (`my`/`opp`).** `config.myTeamSide` is display-only.
- **`commit(producer)` is the single in-game mutation path** in the shell.
- **localStorage keys:** `hoops.teams`, `hoops.game`, `hoops.theme`, and new `hoops.history`.
- **Test runner:** `node --test` with `node:assert`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `app.js` — new pure fns (`upsertHistory`, `removeFromHistory`, `reopenGame`); shell: `KEYS.history`, `state.history`, `saveHistory`/`loadAll`, `homeView` + `renderNav` + `showOnly` + new `render()` routing, `renderTeams` (+ team editor), `renderHistory` (+ open/delete), `startGame` stamps `id`/`date`, END GAME handler saves to history.
- `index.html` — add `#nav`, `#teams`, `#history` sections.
- `styles.css` — nav tabs, team/history list rows, team editor.
- `logic.test.js` — tests for the three pure history functions.

---

## Task 1: History pure functions

**Files:**
- Modify: `app.js` (add three functions near `serialize`/`deserialize`; extend export shim)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, and (in tests) `freshGame`, `endHalf`, `endGame`.
- Produces:
  - `upsertHistory(history, game) → history` — new array; replaces the entry whose `id === game.id`, else appends. Does not mutate the input array.
  - `removeFromHistory(history, id) → history` — new array without the entry of that `id` (no-op if absent).
  - `reopenGame(game) → game` — a clone with `screen: "game"`, a trailing `end_game` log entry removed (if present), and the last `periodScores` snapshot popped.

- [ ] **Step 1: Write the failing tests**

Add to `logic.test.js` (the `clone`, `freshGame`, `endHalf`, `endGame` helpers already exist there):
```js
const { upsertHistory, removeFromHistory, reopenGame } = app;

test('upsertHistory appends a new game and replaces by id without mutating input', () => {
  const a = { id:'g1', score:{ my:1, opp:0 } };
  const b = { id:'g2', score:{ my:2, opp:0 } };
  const h0 = [];
  const h1 = upsertHistory(h0, a);
  assert.strictEqual(h0.length, 0);            // input not mutated
  assert.strictEqual(h1.length, 1);
  const h2 = upsertHistory(h1, b);
  assert.strictEqual(h2.length, 2);
  const h3 = upsertHistory(h2, { id:'g1', score:{ my:9, opp:0 } });
  assert.strictEqual(h3.length, 2);            // replaced, not appended
  assert.strictEqual(h3.find((g)=>g.id==='g1').score.my, 9);
});

test('removeFromHistory removes by id and is a no-op for unknown id', () => {
  const h = [{ id:'g1' }, { id:'g2' }];
  assert.deepStrictEqual(removeFromHistory(h, 'g1'), [{ id:'g2' }]);
  assert.deepStrictEqual(removeFromHistory(h, 'nope'), h);
});

test('reopenGame flips to game screen and cleanly undoes the END GAME', () => {
  let g = freshGame();
  g = endHalf(g, 1000);          // period 2, periodScores=[H1]
  g = endGame(g, 2000);          // summary, periodScores=[H1,H2], trailing end_game log
  assert.strictEqual(g.screen, 'summary');
  assert.strictEqual(g.periodScores.length, 2);

  const r = reopenGame(g);
  assert.strictEqual(r.screen, 'game');
  assert.strictEqual(r.periodScores.length, 1);                    // last snapshot popped
  assert.strictEqual(r.log.some((e)=>e.type==='end_game'), false); // end_game log removed
  assert.strictEqual(g.periodScores.length, 2);                    // original not mutated

  const re = endGame(r, 3000);   // re-ending resnapshots correctly, no double-count
  assert.strictEqual(re.periodScores.length, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `upsertHistory is not a function`.

- [ ] **Step 3: Implement the functions**

In `app.js`, add just above the `serialize` function:
```js
function upsertHistory(history, game) {
  const arr = history.slice();
  const i = arr.findIndex((g) => g.id === game.id);
  if (i >= 0) arr[i] = game; else arr.push(game);
  return arr;
}

function removeFromHistory(history, id) {
  return history.filter((g) => g.id !== id);
}

function reopenGame(game) {
  const g = clone(game);
  g.screen = 'game';
  if (g.log.length && g.log[g.log.length - 1].type === 'end_game') g.log.pop();
  if (g.periodScores.length) g.periodScores.pop();
  return g;
}
```

Extend the `module.exports` object — add `upsertHistory, removeFromHistory, reopenGame`:
```js
    serialize, deserialize, isResumable, migrateGame,
    upsertHistory, removeFromHistory, reopenGame,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (3 new tests, 50 total).

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: history pure functions (upsertHistory, removeFromHistory, reopenGame)"
```

---

## Task 2: Home navigation + history persistence (scaffold)

**Files:**
- Modify: `index.html`, `app.js` (KEYS/state/persistence, `homeView`, `showOnly`, `renderNav`, `render()`, stub `renderTeams`/`renderHistory`), `styles.css`

**Interfaces:**
- Consumes: `serialize`, `deserialize`, `el_each`, `esc`, `renderSetup`, `renderGame`, `renderSummary`, `migrateGame`.
- Produces: `state.history` (array, persisted under `hoops.history`); `saveHistory()`; module-level `homeView` (`"setup"|"teams"|"history"`, default `"setup"`); `showOnly(...ids)`; `renderNav()`; `render()` routes home views; placeholder `renderTeams()`/`renderHistory()` (filled in Tasks 3–4).

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Add the new sections to `index.html`**

Replace the `<main id="app">` block with:
```html
  <main id="app">
    <nav id="nav" hidden></nav>
    <section id="setup" hidden></section>
    <section id="teams" hidden></section>
    <section id="history" hidden></section>
    <section id="game" hidden></section>
    <section id="summary" hidden></section>
  </main>
```

- [ ] **Step 2: Add history persistence and `homeView` state**

In `app.js`, extend `KEYS` and `state`:
```js
const KEYS = { teams: 'hoops.teams', game: 'hoops.game', theme: 'hoops.theme', history: 'hoops.history' };
let state = { teams: [], game: null, theme: 'dark', history: [] };
let homeView = 'setup';
```

Add a `saveHistory` next to `saveGame`:
```js
function saveHistory() { localStorage.setItem(KEYS.history, serialize(state.history)); }
```

In `loadAll`, load history (add this line):
```js
  state.history = deserialize(localStorage.getItem(KEYS.history)) || [];
```

- [ ] **Step 3: Replace screen routing with `showOnly` + home views**

In `app.js`, replace the `screens`/`showScreen` declarations and the whole `render()` with:
```js
const ALL_SECTIONS = ['nav','setup','teams','history','game','summary'];
function showOnly(...visible) {
  for (const id of ALL_SECTIONS) document.getElementById(id).hidden = !visible.includes(id);
}

function renderNav() {
  const tabs = [['setup','New Game'],['teams','Teams'],['history','History']];
  document.getElementById('nav').innerHTML = tabs
    .map(([v,label]) => `<button class="navtab ${homeView===v?'active':''}" data-nav="${v}">${label}</button>`)
    .join('');
  el_each('[data-nav]', (b) => b.onclick = () => { homeView = b.dataset.nav; render(); });
}

function render() {
  stopTick(); // Clear any running interval before routing; renderGame() re-starts it.
  const g = state.game;
  if (g && g.screen === 'game') { showOnly('game'); renderGame(); return; }
  if (g && g.screen === 'summary') { showOnly('summary'); renderSummary(); return; }
  // Home (no active game): tab bar + active tab content.
  renderNav();
  if (homeView === 'teams') { showOnly('nav','teams'); renderTeams(); }
  else if (homeView === 'history') { showOnly('nav','history'); renderHistory(); }
  else { showOnly('nav','setup'); renderSetup(); }
}
```

- [ ] **Step 4: Add placeholder page renderers**

In `app.js`, add stubs (filled in later tasks) — place them after `renderSetup` and its helpers:
```js
function renderTeams() {
  document.getElementById('teams').innerHTML = `<h1>Teams</h1><p class="muted">No teams page yet.</p>`;
}
function renderHistory() {
  document.getElementById('history').innerHTML = `<h1>History</h1><p class="muted">No history yet.</p>`;
}
```

Make "New Game" land on the setup tab after finishing a game — in `newGameFromSummary`, set the home view before render:
```js
function newGameFromSummary() {
  state.game = null;
  saveGame();
  setupDraft = defaultDraft();
  homeView = 'setup';
  render();
}
```

- [ ] **Step 5: Add nav styles**

In `styles.css`, add (near the top-level/`#setup` rules):
```css
#nav { display:flex; gap:4px; padding:8px 8px 0; max-width:640px; margin:0 auto; }
.navtab { flex:1; padding:10px; font-weight:600; background:var(--surface); color:var(--text); border:1px solid var(--border); border-bottom:none; border-radius:8px 8px 0 0; }
.navtab.active { background:var(--accent); color:var(--accent-text); }
#teams, #history { padding:16px; max-width:640px; margin:0 auto; }
```

- [ ] **Step 6: Verify Node load + commit**

Run: `node --test` (still 50 green — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add index.html app.js styles.css
git commit -m "feat: home tab bar (New Game/Teams/History) + history persistence scaffold"
```

Manual browser check (deferred): off-game, three tabs show; tapping Teams/History switches to their (stub) pages and back to New Game; during a game/summary, no tabs.

---

## Task 3: Teams management page

**Files:**
- Modify: `app.js` (`renderTeams` + a `teamEdit` editing state + wiring), `styles.css`

**Interfaces:**
- Consumes: `state.teams`, `saveTeams`, `clone`, `esc`, `renderRoster`, `el_each`, `makeLocalId`, `render`.
- Produces: real `renderTeams()`; module-level `teamEdit` (null, or `{ id, name, players:[{id,num,name}] }` while editing).

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Add the `teamEdit` state and replace the `renderTeams` stub**

In `app.js`, add near `setupDraft`:
```js
let teamEdit = null;   // null = list view; object = editing a team
```

Replace the `renderTeams` stub with the list/editor:
```js
function renderTeams() {
  const el = document.getElementById('teams');
  if (teamEdit) { renderTeamEditor(el); return; }

  const rows = state.teams.length
    ? state.teams.map((t) => `
        <li class="listrow">
          <span class="listmain">${esc(t.name)} <span class="muted">(${t.players.length})</span></span>
          <button data-edit-team="${t.id}">Edit</button>
          <button data-del-team="${t.id}" class="danger">Delete</button>
        </li>`).join('')
    : `<p class="muted">No saved teams yet. Create one from New Game.</p>`;

  el.innerHTML = `<h1>Teams</h1><ul class="list">${rows}</ul>`;

  el_each('[data-edit-team]', (b) => b.onclick = () => {
    const t = state.teams.find((x) => x.id === b.dataset.editTeam);
    teamEdit = { id: t.id, name: t.name, players: clone(t.players) };
    renderTeams();
  });
  el_each('[data-del-team]', (b) => b.onclick = () => {
    const t = state.teams.find((x) => x.id === b.dataset.delTeam);
    if (!confirm(`Delete team "${t.name}"? This cannot be undone.`)) return;
    state.teams = state.teams.filter((x) => x.id !== b.dataset.delTeam);
    saveTeams();
    renderTeams();
  });
}
```

- [ ] **Step 2: Add the team editor renderer + wiring**

In `app.js`, add:
```js
function renderTeamEditor(el) {
  const d = teamEdit;
  el.innerHTML = `
    <h1>Edit Team</h1>
    <section class="card">
      <label>Team name <input id="te-name" value="${esc(d.name)}"></label>
      <div id="te-players">${renderRoster(d.players, 'te')}</div>
      <div class="add-player">
        <input id="te-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="te-add-name" placeholder="Name (optional)">
        <button id="te-add-btn">Add</button>
      </div>
    </section>
    <div class="tip-row">
      <button id="te-save" class="tip">Save</button>
      <button id="te-cancel">Cancel</button>
    </div>
    <p id="te-error" class="error"></p>
  `;

  const $ = (id) => document.getElementById(id);
  $('te-name').oninput = (e) => { d.name = e.target.value; };
  const add = () => {
    const num = parseInt($('te-add-num').value, 10);
    if (isNaN(num)) return;
    d.players.push({ id: makeLocalId(), num, name: $('te-add-name').value.trim() });
    renderTeams();
  };
  $('te-add-btn').onclick = add;
  $('te-add-num').onkeydown = (e) => { if (e.key === 'Enter') add(); };
  el_each('[data-rm]', (b) => b.onclick = () => {
    const [, i] = b.dataset.rm.split(':');   // "te:i"
    d.players.splice(parseInt(i, 10), 1);
    renderTeams();
  });
  $('te-save').onclick = () => {
    if (!d.name.trim()) { $('te-error').textContent = 'Enter a team name.'; return; }
    const t = state.teams.find((x) => x.id === d.id);
    if (t) { t.name = d.name.trim(); t.players = clone(d.players); }
    saveTeams();
    teamEdit = null;
    renderTeams();
  };
  $('te-cancel').onclick = () => { teamEdit = null; renderTeams(); };
}
```
(`renderRoster(d.players, 'te')` produces `data-rm="te:i"` remove buttons, handled above. The `.card`, `.add-player`, `.roster`, `.tip`, `.error`, `.muted` styles already exist from Setup.)

- [ ] **Step 3: Add list-row styles**

In `styles.css`, add:
```css
.list { list-style:none; padding:0; margin:0; }
.listrow { display:flex; align-items:center; gap:8px; padding:10px; background:var(--surface); border-radius:8px; margin-bottom:8px; }
.listmain { flex:1; font-weight:600; }
.listrow button { padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--btn-bg); color:var(--btn-text); }
.listrow button.danger { background:#dc2626; color:#fff; border:none; }
```

- [ ] **Step 4: Verify Node load + commit**

Run: `node --test` (still 50 green) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js styles.css
git commit -m "feat: Teams management page (list, edit roster, delete)"
```

Manual browser check (deferred): Teams tab lists saved teams with counts; Edit opens the roster editor (rename, add/remove players, Save persists, Cancel discards); Delete asks to confirm and removes the team; empty state when none.

---

## Task 4: Game history page + save on END GAME

**Files:**
- Modify: `app.js` (`startGame` stamps `id`/`date`; END GAME handler upserts to history; `renderHistory` + open/delete), `styles.css`

**Interfaces:**
- Consumes: `upsertHistory`, `removeFromHistory`, `reopenGame`, `state.history`, `saveHistory`, `saveGame`, `commit`, `endGame`, `makeLocalId`, `esc`, `el_each`, `render`.
- Produces: every game has `id` and `date`; finished games are saved to `state.history`; real `renderHistory()` with Open (re-open to keep scoring) and Delete.

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Stamp `id` and `date` on a new game**

In `app.js` `startGame`, right after `let g = newGame({...});` (before `setPossession`), add:
```js
  g.id = makeLocalId();
  g.date = Date.now();
```

- [ ] **Step 2: Save the finished game to history on END GAME**

In `app.js` `wireGame`, replace the END GAME handler:
```js
  $('btn-endgame') && ($('btn-endgame').onclick = () => commit((game,now)=>endGame(game,now)));
```
with one that also records to history (using the existing `id`, assigning one if an older game lacks it):
```js
  $('btn-endgame') && ($('btn-endgame').onclick = () => {
    commit((game,now)=>endGame(game,now));
    if (!state.game.id) state.game.id = makeLocalId();
    state.history = upsertHistory(state.history, clone(state.game));
    saveHistory();
  });
```

- [ ] **Step 3: Replace the `renderHistory` stub**

In `app.js`, replace the `renderHistory` stub with:
```js
function renderHistory() {
  const el = document.getElementById('history');
  const games = state.history.slice().reverse();   // newest first
  const fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString() : '';
  const rows = games.length
    ? games.map((g) => {
        const my = g.score?.my ?? 0, opp = g.score?.opp ?? 0;
        const wl = my > opp ? 'W' : my < opp ? 'L' : 'T';
        const myName = g.myTeam?.name ?? 'My Team', oppName = g.oppTeam?.name ?? 'Opp';
        return `
          <li class="listrow">
            <span class="listmain">${esc(myName)} vs ${esc(oppName)}
              <span class="muted">${fmtDate(g.date)} · ${my}–${opp} ${wl}</span></span>
            <button data-open-game="${g.id}">Open</button>
            <button data-del-game="${g.id}" class="danger">Delete</button>
          </li>`;
      }).join('')
    : `<p class="muted">No finished games yet.</p>`;

  el.innerHTML = `<h1>History</h1><ul class="list">${rows}</ul>`;

  el_each('[data-open-game]', (b) => b.onclick = () => openHistoryGame(b.dataset.openGame));
  el_each('[data-del-game]', (b) => b.onclick = () => {
    if (!confirm('Delete this game from history?')) return;
    state.history = removeFromHistory(state.history, b.dataset.delGame);
    saveHistory();
    renderHistory();
  });
}

function openHistoryGame(id) {
  const entry = state.history.find((g) => g.id === id);
  if (!entry) return;
  if (state.game && state.game.screen === 'game' && state.game.id !== id) {
    if (!confirm('Discard the current in-progress game and open this one?')) return;
  }
  state.game = reopenGame(entry);
  saveGame();
  render();
}
```

- [ ] **Step 4: Verify Node load + commit**

Run: `node --test` (still 50 green — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js styles.css
git commit -m "feat: Game history page — save on END GAME, re-open to keep scoring, delete"
```

Manual browser check (deferred): play a game → END GAME → it appears under History (date, "MyTeam vs Opp", score, W/L); Open re-opens it into the game screen to keep scoring and END GAME again updates the same entry (no duplicate); Delete confirms and removes it; opening a history game while a different game is in progress asks to confirm first.

---

## Notes for the implementer

- **TDD only applies to Task 1** (the pure history functions). Tasks 2–4 are shell — verify with the Node load-check and the manual browser steps; don't add unit tests for DOM/persistence.
- **Keep `app.js` Node-loadable** after every task (`node -e require`). All new render/handler code lives in functions invoked from `render()`/events, never at module load.
- **`reopenGame` returns a clone**, and the END GAME handler stores `clone(state.game)` into history, so editing the live game never mutates a history entry and vice-versa.
- **`Date.now()` stays in the shell** (`startGame` stamps `date`); the pure history functions take no time argument.
