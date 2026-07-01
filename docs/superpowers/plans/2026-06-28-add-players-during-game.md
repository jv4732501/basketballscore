# Add Players During Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user start a game with only team names and add players to either team mid-game (own-team additions persist to the saved team).

**Architecture:** Incremental change to the existing single-file scorer (`app.js` pure-logic + shell, `styles.css`, `logic.test.js`). One new pure function is TDD'd; the Setup relaxation and the in-column add UI are shell, verified by a Node load-check + manual browser QA.

**Tech Stack:** Vanilla JS (ES2020+), HTML, CSS. Node's built-in `node --test` (no `npm install`).

## Global Constraints

- **No runtime dependencies, no build step, no network.** App is `index.html` + `styles.css` + `app.js`.
- **`app.js` must stay `require()`-able in Node with no DOM** — no top-level `document`/`window`/`localStorage`; only the `DOMContentLoaded` bootstrap under `if (typeof document !== 'undefined')`. Verify with `node -e "require('./app.js'); console.log('loads OK')"`.
- **Pure-logic functions are deterministic and side-effect-free:** inputs as arguments, no `Date.now()` in logic, `structuredClone` via `clone()`, never mutate inputs.
- **Both teams use the same full stat set** (`emptyMyStats()`); per-team state keyed by identity (`my`/`opp`).
- **`commit(producer)` is the single in-game mutation path** in the shell.
- **Test runner:** `node --test` with `node:assert`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `app.js` — new pure `addPlayerToGame`; shell: relax `startGame` validation, `addOpen` state, `renderPlayers` "+ Add" UI, `wireGame` add handlers, `addGamePlayerFromForm` (+ persist to saved team).
- `styles.css` — `.addbtn` / `.addpl` mini-form styles.
- `logic.test.js` — tests for `addPlayerToGame`.

---

## Task 1: `addPlayerToGame` pure function

**Files:**
- Modify: `app.js` (add function near `teamToSave`; extend export shim)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `emptyMyStats`; (tests) `freshGame`.
- Produces: `addPlayerToGame(game, team, { id, num, name }) → game` — a clone with `{ id, num, name, ...emptyMyStats() }` appended to `team === "my" ? myTeam : oppTeam`; the other team untouched; input game not mutated.

- [ ] **Step 1: Write the failing tests**

Add to `logic.test.js` (the `freshGame` helper already exists):
```js
const { addPlayerToGame } = app;

test('addPlayerToGame appends a full-stat player to the named team', () => {
  const g0 = freshGame();
  const g = addPlayerToGame(g0, 'my', { id:'p9', num:23, name:'New' });
  assert.strictEqual(g0.myTeam.players.length, 1);   // input not mutated
  assert.strictEqual(g.myTeam.players.length, 2);
  const p = g.myTeam.players[1];
  assert.strictEqual(p.id, 'p9');
  assert.strictEqual(p.num, 23);
  assert.strictEqual(p.name, 'New');
  assert.strictEqual(p.pts, 0);
  assert.strictEqual(p.oreb, 0);                      // full zeroed stat set
  assert.strictEqual('dreb' in p, true);
  assert.strictEqual(g.oppTeam.players.length, 1);    // opponent untouched
});

test('addPlayerToGame can add to the opponent', () => {
  const g = addPlayerToGame(freshGame(), 'opp', { id:'o9', num:7, name:'' });
  assert.strictEqual(g.oppTeam.players.length, 2);
  assert.strictEqual(g.oppTeam.players[1].num, 7);
  assert.strictEqual(g.myTeam.players.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `addPlayerToGame is not a function`.

- [ ] **Step 3: Implement**

In `app.js`, add near `teamToSave`:
```js
function addPlayerToGame(game, team, { id, num, name }) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  t.players.push({ id, num, name, ...emptyMyStats() });
  return g;
}
```

Extend the `module.exports` object — add `addPlayerToGame` (e.g. on the `teamToSave` line):
```js
    teamToSave, addPlayerToGame,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (2 new tests, 52 total).

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: addPlayerToGame pure function"
```

---

## Task 2: Setup relaxation + in-column "+ Add" (shell)

**Files:**
- Modify: `app.js` (`startGame`, `addOpen` state, `renderPlayers`, `wireGame`, `addGamePlayerFromForm`), `styles.css`

**Interfaces:**
- Consumes: `addPlayerToGame`, `commit`, `makeLocalId`, `clone`, `esc`, `el_each`, `saveTeams`, `render`, `state`.
- Produces: a game can start with empty rosters; each team column has a "+ Add" button revealing an inline jersey#/name form; adding appends via `addPlayerToGame` and (for `my`) persists to the saved team.

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Relax the Setup validation**

In `app.js` `startGame`, delete the players-required line:
```js
  if (!d.myPlayers.length || !d.oppPlayers.length) { err.textContent = 'Add players to both teams.'; return; }
```
(Keep the two name checks above it. Empty rosters are now allowed.)

- [ ] **Step 2: Add the `addOpen` state and the "+ Add" UI in `renderPlayers`**

In `app.js`, add a module-level state var near the other shell state (e.g. next to `let teamEdit = null;`):
```js
let addOpen = null;   // 'my' | 'opp' | null — which column's add-form is open
```

Replace `renderPlayers` with:
```js
function renderPlayers(g, team) {
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const rows = t.players.map((p) => `
    <button class="pl ${g.selectedPlayerId===p.id?'sel':''}" data-pl="${team}:${p.id}">
      <span class="num">#${p.num}</span>
      <span class="nm">${esc(p.name||'')}</span>
      <span class="pp">${p.pts} pts · ${p.pf} f</span>
    </button>`).join('');
  const addUI = addOpen === team
    ? `<div class="addpl">
         <input class="num" type="number" inputmode="numeric" placeholder="#" data-addnum="${team}">
         <input placeholder="Name" data-addname="${team}">
         <button data-addgo="${team}">Add</button>
         <button data-addclose="${team}">Close</button>
       </div>`
    : `<button class="addbtn" data-addopen="${team}">+ Add</button>`;
  return rows + addUI;
}
```

- [ ] **Step 3: Wire the add UI in `wireGame`**

In `app.js` `wireGame`, after the existing `[data-pl]` handler block, add:
```js
  el_each('[data-addopen]', (b) => b.onclick = () => { addOpen = b.dataset.addopen; render(); });
  el_each('[data-addclose]', (b) => b.onclick = () => { addOpen = null; render(); });
  el_each('[data-addgo]', (b) => b.onclick = () => addGamePlayerFromForm(b.dataset.addgo));
  el_each('[data-addnum]', (b) => b.onkeydown = (e) => {
    if (e.key === 'Enter') document.querySelector(`[data-addgo="${b.dataset.addnum}"]`).click();
  });
```

- [ ] **Step 4: Add `addGamePlayerFromForm`**

In `app.js`, add (near `recordSelectedStat` or the other game handlers):
```js
function addGamePlayerFromForm(team) {
  const numEl = document.querySelector(`[data-addnum="${team}"]`);
  const nameEl = document.querySelector(`[data-addname="${team}"]`);
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;                       // blank/non-numeric jersey → no-op
  const player = { id: makeLocalId(), num, name: nameEl.value.trim() };
  commit((game) => addPlayerToGame(game, team, player));   // mutate → save → render
  if (team === 'my') {                          // persist to the saved team
    const t = state.teams.find((x) => x.id === state.game.myTeam.id);
    if (t) { t.players.push({ id: player.id, num: player.num, name: player.name }); saveTeams(); }
  }
}
```
(`commit` re-renders with `addOpen` still set, so the form stays open with fresh empty inputs — you can add several players in a row; "Close" dismisses it.)

- [ ] **Step 5: Add the mini-form styles**

In `styles.css`, add (near the `.pl` / court rules):
```css
.addbtn { width:100%; padding:6px; margin-top:4px; font-size:.8rem; background:var(--surface); color:var(--text); border:1px dashed var(--border); border-radius:6px; }
.addpl { display:flex; flex-direction:column; gap:4px; margin-top:4px; }
.addpl input { width:100%; padding:6px; font-size:.85rem; border:1px solid var(--input-border); border-radius:6px; background:var(--input-bg); color:var(--text); }
.addpl button { padding:6px; font-size:.8rem; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```

- [ ] **Step 6: Verify Node load + commit**

Run: `node --test` (still 52 green — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js styles.css
git commit -m "feat: start with names only; add players to either team mid-game"
```

Manual browser check (deferred): start a game with empty rosters (just names); on the game screen each column shows "+ Add"; adding a jersey# (+ optional name) inserts a tappable player; a blank number is ignored; adding to your team also appears in that team on the Teams page next time; "Close" dismisses the form.

---

## Notes for the implementer

- **Only Task 1 is TDD'd** (the pure function). Task 2 is shell — verify with the Node load-check and the manual steps; don't add unit tests for DOM/persistence.
- **Keep `app.js` Node-loadable** after every task (`node -e require`). The new render/handler code lives in functions invoked from `render()`/events, never at module load.
- **`commit` stays the one in-game mutation path** — the add goes through it; the save-team persistence is a separate shell step after `commit`.
- **`Date.now()` is not needed** here; `addPlayerToGame` takes no time argument.
