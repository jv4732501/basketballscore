# Player Menu, Substitutions & Minutes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-press a player for a menu (Activity dialog + Sub In/Out), show on-court players' numbers in green, and add a MIN (minutes-played) column to the box score driven by game-clock time on court.

**Architecture:** Incremental change to the existing single-file scorer. Court-state fields and the minutes math are pure-logic, developed test-first with `node --test`. The long-press menu, activity dialog, green number, and MIN column are shell, verified by a Node load-check + manual browser QA. Tasks are ordered so each leaves the app working.

**Tech Stack:** Vanilla JS (ES2020+), HTML, CSS. Node's built-in `node --test`.

## Global Constraints

- **No runtime dependencies, no build step, no network.** App is `index.html` + `styles.css` + `app.js`.
- **`app.js` must stay `require()`-able in Node with no DOM** — no top-level `document`/`window`/`localStorage`. Verify with `node -e "require('./app.js'); console.log('loads OK')"`.
- **Pure-logic functions are deterministic and side-effect-free:** all inputs as arguments (including `nowMs`), no `Date.now()` in logic, `structuredClone` via `clone()`, never mutate inputs.
- **Both teams symmetric; state keyed by identity (`my`/`opp`).**
- **Minutes = `clockAtSubIn − clockAtSubOut`** per on-court interval (game-clock time that advanced while on court, naturally excluding stopped time). On-court is informational; it never restricts stat entry.
- **`commit(producer)` is the single in-game mutation path** in the shell; subs route through it.
- **Subs are logged but not undoable** (the `sub_in`/`sub_out` entries carry no `rev`).
- **Test runner:** `node --test`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- `app.js` — `emptyMyStats` gains court fields; new pure `subIn`/`subOut`/`fmtMinutes`; `endHalf`/`addOvertime`/`endGame` gain close/reopen of on-court intervals (`closeOnCourt`/`reopenOnCourt` helpers); shell: player long-press menu (`attachPlayerPress`, `openPlayerMenu`), activity dialog (`openActivityDialog`/`closeActivityDialog`), a shared `openPopover` helper (refactored out of `openStatMenu`), green on-court number in `renderPlayers`, MIN column in `boxScore`.
- `styles.css` — green on-court number, activity dialog.
- `logic.test.js` — tests for court fields, `subIn`/`subOut`, period close/reopen, `fmtMinutes`.

---

## Task 1: Court fields + subIn/subOut/fmtMinutes (pure)

**Files:**
- Modify: `app.js` (`emptyMyStats`, new `subIn`/`subOut`/`fmtMinutes`, export shim)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `findPlayer`, `clockRemaining`, `pushLog`, `playerTag` (existing).
- Produces:
  - Player objects carry `onCourt:false`, `inClock:null`, `courtSecs:0` (added to `emptyMyStats`, which is spread into players by `newGame` and `addPlayerToGame`).
  - `subIn(game, team, playerId, nowMs) → game` — sets `onCourt=true`, `inClock=clockRemaining(clock,nowMs)`, logs `sub_in`; no-op (returns original) if not found or already on court.
  - `subOut(game, team, playerId, nowMs) → game` — `courtSecs += inClock − clockRemaining(clock,nowMs)`, `onCourt=false`, `inClock=null`, logs `sub_out`; no-op if not found or already off court.
  - `fmtMinutes(secs) → string` — `((secs||0)/60).toFixed(1)`.

- [ ] **Step 1: Update/add the failing tests**

In `logic.test.js`, update the "empty stat shapes" test to the new shape:
```js
test('empty stat shapes', () => {
  assert.deepStrictEqual(emptyMyStats(), {
    pts:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, oreb:0, dreb:0, stl:0, blk:0, ast:0, to:0, pf:0,
    onCourt:false, inClock:null, courtSecs:0,
  });
});
```

Add (near the other recordStat/freshGame tests):
```js
const { subIn, subOut, fmtMinutes } = app;

test('subIn marks a player on court and stamps inClock', () => {
  let g = startClock(freshGame(), 1000);          // running, remaining 18*60
  g = subIn(g, 'my', 'p1', 1000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.onCourt, true);
  assert.strictEqual(p.inClock, 18*60);
  assert.strictEqual(g.log[g.log.length-1].type, 'sub_in');
});

test('subOut accrues court seconds = clockIn - clockOut and clears on court', () => {
  let g = startClock(freshGame(), 1000);
  g = subIn(g, 'my', 'p1', 1000);                 // inClock 18*60
  g = subOut(g, 'my', 'p1', 61000);               // 60s later → remaining 18*60-60
  const p = g.myTeam.players[0];
  assert.strictEqual(p.courtSecs, 60);
  assert.strictEqual(p.onCourt, false);
  assert.strictEqual(p.inClock, null);
  assert.strictEqual(g.log[g.log.length-1].type, 'sub_out');
});

test('subIn/subOut are no-ops in the wrong state', () => {
  const g0 = freshGame();
  assert.deepStrictEqual(subOut(g0, 'my', 'p1', 1000), g0);   // not on court → no-op
  let g = subIn(g0, 'my', 'p1', 1000);
  assert.deepStrictEqual(subIn(g, 'my', 'p1', 2000), g);      // already on court → no-op
});

test('fmtMinutes formats seconds to one-decimal minutes', () => {
  assert.strictEqual(fmtMinutes(0), '0.0');
  assert.strictEqual(fmtMinutes(90), '1.5');
  assert.strictEqual(fmtMinutes(undefined), '0.0');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — empty-stat-shapes mismatch and `subIn is not a function`.

- [ ] **Step 3: Implement**

In `app.js`, extend `emptyMyStats` (add the three court fields):
```js
function emptyMyStats() {
  return { pts:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, oreb:0, dreb:0, stl:0, blk:0, ast:0, to:0, pf:0,
    onCourt:false, inClock:null, courtSecs:0 };
}
```

Add `subIn`, `subOut`, and `fmtMinutes` (place near `recordStat`/`teamDisplayName`):
```js
function subIn(game, team, playerId, nowMs) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p || p.onCourt) return game;
  p.onCourt = true;
  p.inClock = clockRemaining(g.clock, nowMs);
  return pushLog(g, { team, playerId, type:'sub_in', detail:`${playerTag(p)} subs in` }, nowMs);
}

function subOut(game, team, playerId, nowMs) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p || !p.onCourt) return game;
  p.courtSecs += p.inClock - clockRemaining(g.clock, nowMs);
  p.onCourt = false;
  p.inClock = null;
  return pushLog(g, { team, playerId, type:'sub_out', detail:`${playerTag(p)} subs out` }, nowMs);
}

function fmtMinutes(secs) { return ((secs || 0) / 60).toFixed(1); }
```

Add to the `module.exports` object: `subIn, subOut, fmtMinutes`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (suite green, e.g. 56 total).

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: player court fields + subIn/subOut/fmtMinutes (minutes core)"
```

---

## Task 2: Close/reopen on-court intervals at period boundaries (pure)

**Files:**
- Modify: `app.js` (`endHalf`, `addOvertime`, `endGame`, new internal `closeOnCourt`/`reopenOnCourt`)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `clockRemaining` (existing), the court fields from Task 1.
- Produces: `closeOnCourt(game) → game` and `reopenOnCourt(game) → game` (internal, not exported). `endHalf`/`addOvertime` close every on-court interval at the ending period's clock, then reopen at the new period's full clock; `endGame` closes (no reopen). A player on court across a period boundary, and one still on court at game end, accrue correct `courtSecs`.

- [ ] **Step 1: Write the failing tests**

Add to `logic.test.js`:
```js
test('court time accrues across a half boundary', () => {
  let g = startClock(freshGame(), 1000);          // H1 running, remaining 18*60
  g = subIn(g, 'my', 'p1', 1000);                 // inClock 18*60
  g = endHalf(g, 481000);                          // 480s elapsed → close at 18*60-480; reopen at H2 full
  assert.strictEqual(g.myTeam.players[0].courtSecs, 480);
  assert.strictEqual(g.period, 2);
  assert.strictEqual(g.myTeam.players[0].onCourt, true);
  assert.strictEqual(g.myTeam.players[0].inClock, 18*60);   // reopened at new full clock
  g = startClock(g, 500000);                       // H2 running
  g = subOut(g, 'my', 'p1', 560000);               // 60s in H2
  assert.strictEqual(g.myTeam.players[0].courtSecs, 540);   // 480 + 60
});

test('endGame closes the final on-court interval', () => {
  let g = startClock(freshGame(), 1000);
  g = subIn(g, 'my', 'p1', 1000);
  g = endGame(g, 121000);                          // 120s elapsed
  assert.strictEqual(g.screen, 'summary');
  assert.strictEqual(g.myTeam.players[0].courtSecs, 120);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `courtSecs` stays 0 (period functions don't close intervals yet).

- [ ] **Step 3: Implement**

In `app.js`, add the two internal helpers (near `snapshotPeriod`):
```js
function closeOnCourt(game) {
  const g = clone(game);
  const rem = g.clock.remainingSec;
  for (const t of [g.myTeam, g.oppTeam])
    for (const p of t.players)
      if (p.onCourt && p.inClock != null) p.courtSecs += p.inClock - rem;
  return g;
}

function reopenOnCourt(game) {
  const g = clone(game);
  const rem = g.clock.remainingSec;
  for (const t of [g.myTeam, g.oppTeam])
    for (const p of t.players)
      if (p.onCourt) p.inClock = rem;
  return g;
}
```

Update `endHalf` — close after the clock stops, reopen after the clock is reset:
```js
function endHalf(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.halfLengthMin * 60, running:false, startedAt:null };
  g = reopenOnCourt(g);
  g.teamFouls = { my:0, opp:0 };
  g = pushLog(g, { type:'end_period', detail:`End of ${label}` }, nowMs);
  return g;
}
```

Update `addOvertime` the same way:
```js
function addOvertime(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.otLengthMin * 60, running:false, startedAt:null };
  g = reopenOnCourt(g);
  g.teamFouls = { my:0, opp:0 };
  g = setPossession(g, g.possession === 'my' ? 'opp' : 'my');
  g = pushLog(g, { type:'end_period', detail:`End of ${label} — overtime` }, nowMs);
  return g;
}
```

Update `endGame` — close, no reopen:
```js
function endGame(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = closeOnCourt(g);
  g = snapshotPeriod(g);
  g.screen = 'summary';
  g = pushLog(g, { type:'end_game', detail:'Final' }, nowMs);
  return g;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (suite green; the existing period tests still pass — closing is a no-op when no one is on court).

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: close/reopen on-court intervals at period boundaries and end game"
```

---

## Task 3: Player long-press menu, subs, green number, activity dialog (shell)

**Files:**
- Modify: `app.js` (`renderPlayers`, player tile wiring in `wireGame`, new `attachPlayerPress`/`openPlayerMenu`/`openActivityDialog`/`closeActivityDialog`, refactor `openStatMenu` to share an `openPopover` helper), `styles.css`

**Interfaces:**
- Consumes: `subIn`, `subOut` (Task 1), `commit`, `closeStatMenu`/popover pattern, `initials`, `esc`, `periodLabel`, `el_each`, `state`, `render`, `saveGame`.
- Produces: long-press on a player tile opens a menu (Activity + contextual Sub In/Out); on-court number renders green; the Activity dialog lists a player's events.

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Refactor the popover into a shared `openPopover` helper**

In `app.js`, rename `closeStatMenu` to `closeMenu` (update its use inside `openStatMenu` and the backdrop handler), and extract the popover scaffolding so both the stat menu and the new player menu reuse it. Replace the existing `closeStatMenu`/`openStatMenu` with:
```js
function closeMenu() {
  document.querySelectorAll('.popmenu, .popback').forEach((n) => n.remove());
}

function openPopover(anchorBtn, items) {
  closeMenu();
  if (!items.length) return;
  const back = document.createElement('div');
  back.className = 'popback';
  back.addEventListener('pointerdown', closeMenu);
  const menu = document.createElement('div');
  menu.className = 'popmenu';
  items.forEach((it) => {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); it.act(); });
    menu.appendChild(b);
  });
  document.body.appendChild(back);
  document.body.appendChild(menu);
  const r = anchorBtn.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8) + 'px';
}

function openStatMenu(anchorBtn, stat) {
  const isShot = !!SHOT_INFO[stat];
  const items = [];
  if (isShot) items.push({ label:'Miss', act:() => recordSelectedStat(stat, { made:false }) });
  (MODIFIERS[stat] || []).forEach((m) =>
    items.push({ label:m, act:() => recordSelectedStat(stat, { made:true, modifier:m }) }));
  openPopover(anchorBtn, items);
}
```
(Any other reference to `closeStatMenu` elsewhere in the file must be updated to `closeMenu` — grep to confirm none remain.)

- [ ] **Step 2: Green on-court number in `renderPlayers`**

Wrap the jersey number in its own span so it can be colored:
```js
function renderPlayers(g, team) {
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const rows = t.players.map((p) => `
    <button class="pl ${g.selectedPlayerId===p.id?'sel':''}" data-pl="${team}:${p.id}">
      <span class="plhdr"><span class="pnum${p.onCourt?' oncourt':''}">#${p.num}</span> ${esc(initials(p.name))}</span>
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

- [ ] **Step 3: Player press handler (replace the `[data-pl]` wiring)**

In `wireGame`, replace the existing `el_each('[data-pl]', …)` select handler with:
```js
  el_each('[data-pl]', (b) => attachPlayerPress(b));
```

Add `attachPlayerPress` (near `attachPressHandlers`):
```js
function attachPlayerPress(btn) {
  const [team, id] = btn.dataset.pl.split(':');
  let timer = null, longFired = false;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => { longFired = true; openPlayerMenu(btn, team, id); }, 500);
  };
  const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('touchstart', start, { passive:true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.onclick = () => {
    if (longFired) { longFired = false; return; }
    state.game.selectedPlayerId = (state.game.selectedPlayerId === id) ? null : id;
    saveGame(); render();
  };
}
```

- [ ] **Step 4: Player menu + activity dialog**

Add `openPlayerMenu`, `openActivityDialog`, `closeActivityDialog` (near `openStatMenu`):
```js
function openPlayerMenu(anchorBtn, team, id) {
  const t = team === 'my' ? state.game.myTeam : state.game.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const subItem = p.onCourt
    ? { label:'Sub Out', act:() => commit((game,now)=>subOut(game, team, id, now)) }
    : { label:'Sub In',  act:() => commit((game,now)=>subIn(game, team, id, now)) };
  openPopover(anchorBtn, [
    { label:'Activity', act:() => openActivityDialog(team, id) },
    subItem,
  ]);
}

function closeActivityDialog() {
  document.querySelectorAll('.dialog, .dlgback').forEach((n) => n.remove());
}

function openActivityDialog(team, id) {
  const g = state.game;
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const events = g.log.filter((e) => e.playerId === id).reverse();   // newest first
  const rows = events.length
    ? events.map((e) => `<div class="ev">${e.clockText} ${periodLabel(e.period, g.config.numHalves)} — ${esc(e.detail)}</div>`).join('')
    : `<p class="muted">No activity yet</p>`;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>#${p.num} ${esc(initials(p.name))}</h3><div class="dlgbody">${rows}</div><button class="dlgclose">Close</button>`;
  dlg.querySelector('.dlgclose').addEventListener('click', closeActivityDialog);
  document.body.appendChild(back);
  document.body.appendChild(dlg);
}
```

- [ ] **Step 5: CSS — green number + dialog**

In `styles.css`, add:
```css
.pnum.oncourt { color:#16a34a; }
.dlgback { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.5); }
.dialog { position:fixed; z-index:61; left:50%; top:50%; transform:translate(-50%,-50%); width:min(90vw,420px); max-height:80vh; display:flex; flex-direction:column; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:10px; padding:12px; box-shadow:0 8px 28px rgba(0,0,0,.5); }
.dialog h3 { margin:0 0 8px; }
.dlgbody { overflow-y:auto; font-size:.85rem; }
.dlgbody .ev { padding:3px 0; border-bottom:1px solid var(--row-border); }
.dlgclose { margin-top:10px; padding:10px; font-weight:700; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```

- [ ] **Step 6: Verify Node load + commit**

Run: `node --test` (still green — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`. Also grep to confirm no stale `closeStatMenu` references remain.

```bash
git add app.js styles.css
git commit -m "feat: long-press player menu (Activity + Sub In/Out), green on-court number"
```

Manual browser check (deferred): long-press a player → menu with Activity + Sub In/Out; Sub In turns the number green and Sub Out turns it back; Activity opens a scrollable dialog of that player's events (newest first), dismissed by Close or backdrop; quick tap still selects; the shot/foul long-press menu still works.

---

## Task 4: MIN column in the box score (shell)

**Files:**
- Modify: `app.js` (`boxScore`)

**Interfaces:**
- Consumes: `fmtMinutes` (Task 1), `p.courtSecs`.
- Produces: each team's box-score table gains a trailing **MIN** column showing minutes to one decimal.

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Add the MIN column to `boxScore`**

In `app.js`, update `boxScore`: add `'MIN'` to `cols` (after `'FLS'`) and a `MIN` cell (after the `pf` cell):
```js
function boxScore(team) {
  const cols = ['PTS','FG','3PT','FT','OREB','DREB','REB','STL','BLK','AST','TO','FLS','MIN'];
  const rows = team.players.slice().sort((a,b)=>a.num-b.num).map((p)=>`
    <tr><td>#${p.num} ${esc(p.name||'')}</td>
      <td>${p.pts}</td><td>${fmtShot(p.fgm+p.tpm,p.fga+p.tpa)}</td><td>${fmtShot(p.tpm,p.tpa)}</td>
      <td>${fmtShot(p.ftm,p.fta)}</td><td>${p.oreb}</td><td>${p.dreb}</td><td>${p.oreb+p.dreb}</td>
      <td>${p.stl}</td><td>${p.blk}</td>
      <td>${p.ast}</td><td>${p.to}</td><td>${p.pf}</td><td>${fmtMinutes(p.courtSecs)}</td></tr>`).join('');
  return `<h2>${esc(team.name)}</h2><table class="bs"><thead><tr><th>Player</th>${cols.map((c)=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}
```
(`fmtMinutes` guards `undefined`, so old saved games without `courtSecs` show `0.0` rather than `NaN`.)

- [ ] **Step 2: Verify Node load + commit**

Run: `node --test` (still green) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js
git commit -m "feat: MIN (minutes played) column in the box score"
```

Manual browser check (deferred): play a game, sub players in/out, END GAME → each box score shows a MIN column with one-decimal minutes; a player on court the whole game shows roughly the elapsed game time; a never-subbed-in player shows 0.0.

---

## Notes for the implementer

- **Tasks 1–2 are TDD'd** (pure logic). Tasks 3–4 are shell — verify with the load-check + manual steps; no new unit tests for DOM.
- **`emptyMyStats` is the single source** for player fields (spread by both `newGame` and `addPlayerToGame`), and `migrateGame` already hydrates old players via `{ ...emptyMyStats(), ...p }`, so resumed pre-cycle games get `courtSecs:0` for free.
- **Minutes model:** `courtSecs` accumulates `clockIn − clockOut` per interval; the period functions close/reopen so cross-period and end-of-game intervals are counted. `Date.now()` stays in the shell (subs route through `commit`, which supplies `nowMs`).
- **Subs are not undoable** — `sub_in`/`sub_out` carry no `rev`, so UNDO ignores them (the log already treats no-`rev` entries this way).
- **`openPopover`** is shared by the stat menu and the player menu; the activity dialog is its own centered modal with a darker backdrop.
