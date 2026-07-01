# Shooting & Rebound Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MAKE/MISS toggle with quick-tap = made / long-press = an in-DOM menu (Miss + shot modifiers), split rebounds into OREB/DREB, and merge the controls into one button grid with UNDO filling the cells beside FOUL.

**Architecture:** Incremental change to the existing single-file scorer (`app.js` pure-logic + shell, `styles.css`, `logic.test.js`). Pure-logic changes are TDD'd with `node --test`; shell changes are load-checked (`node -e require`) and manually verified in the browser. Tasks are grouped by feature so each leaves the app in a working state.

**Tech Stack:** Vanilla JS (ES2020+), HTML, CSS. Node's built-in `node --test` (no `npm install`).

## Global Constraints

- **No runtime dependencies, no build step, no network.** App is `index.html` + `styles.css` + `app.js`.
- **`app.js` must stay `require()`-able in Node with no DOM** — no top-level `document`/`window`/`localStorage`; only the `DOMContentLoaded` bootstrap under `if (typeof document !== 'undefined')`. Verify after every task with `node -e "require('./app.js'); console.log('loads OK')"`.
- **Pure-logic functions are deterministic and side-effect-free:** all inputs as arguments (incl. `nowMs`), no `Date.now()` in logic, `structuredClone` via `clone()`, never mutate inputs.
- **Per-team state keyed by identity (`my`/`opp`).** Both teams record the same full stat set.
- **A miss is a real missed attempt** (attempt++ only, no points), passed to `recordStat` via an explicit `made` flag — not a cosmetic modifier. There is **no `makeMode`**.
- **`commit(producer)` is the single game-mutation path** in the shell.
- **Test runner:** `node --test` with `node:assert`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

All changes are to existing files:
- `app.js` — `recordStat` (+`made` flag, drop `makeMode`), `newGame`, `undo`, `emptyMyStats`, `STAT_TYPES`, `PLAIN_LABEL`, `boxScore`; shell: `renderControls`, `wireGame`, `recordSelectedStat`, `attachPressHandlers`, replace `openModifierMenu` with an in-DOM `openStatMenu`/`closeStatMenu`.
- `styles.css` — popover menu styles; unified button grid.
- `logic.test.js` — make/miss via `made`, oreb/dreb, drop makeMode tests.

---

## Task 1: Shooting — explicit made/miss + in-DOM shot menu

**Files:**
- Modify: `app.js` (`recordStat`, `newGame`, `undo`; shell `renderControls`, `wireGame`, `recordSelectedStat`, `attachPressHandlers`, `openModifierMenu`→`openStatMenu`), `styles.css`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `pushLog`, `SHOT_INFO`, `MODIFIERS`, `findPlayer`, `playerTag`, `commit`, `selectedTeam`, `el_each`.
- Produces: `recordStat(game, { team, playerId, stat, modifier, made = true }, nowMs)` — for a shot, `made:true` adds points+make+attempt, `made:false` adds attempt only; no `makeMode` anywhere. Shell `recordSelectedStat(stat, opts = {})` where `opts = { made?, modifier? }`. `openStatMenu(anchorBtn, stat)` / `closeStatMenu()` render an in-DOM popover.

This changes existing behavior, so update the affected tests to the new model first (reverse-TDD), watch them fail, then change the code.

- [ ] **Step 1: Update the logic tests to the `made`-flag model**

In `logic.test.js`:

Remove the makeMode assertion in the "newGame builds initial state keyed by identity" test (delete this line, ~67):
```js
  assert.strictEqual(g.makeMode, true);
```

Replace the "miss records attempt only and resets makeMode" test (~143–154) with:
```js
test('a shot with made:false records an attempt only (a miss)', () => {
  let g = freshGame();
  g = recordStat(g, { team:'my', playerId:'p1', stat:'3pt', made:false }, 1000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.tpm, 0);
  assert.strictEqual(p.tpa, 1);
  assert.strictEqual(p.pts, 0);
  assert.strictEqual(g.score.my, 0);
  assert.strictEqual(g.log[0].type, '3pt_miss');
});
```

Replace the "opponent shots respect makeMode (miss when in MISS mode)" test (~173–180) with:
```js
test('opponent shot with made:false is a miss', () => {
  let g = freshGame();
  g = recordStat(g, { team:'opp', playerId:'o1', stat:'2pt', made:false }, 1000);
  assert.strictEqual(g.score.opp, 0);                 // miss → no points
  assert.strictEqual(g.oppTeam.players[0].fga, 1);    // attempt recorded
});
```

Replace the "my miss captures prior makeMode in rev for undo" test (~182–188) with:
```js
test('undo reverses a missed shot (attempt removed)', () => {
  let g = freshGame();
  g = recordStat(g, { team:'my', playerId:'p1', stat:'2pt', made:false }, 1000);
  assert.strictEqual(g.myTeam.players[0].fga, 1);
  g = undo(g);
  assert.strictEqual(g.myTeam.players[0].fga, 0);
  assert.strictEqual(g.log.length, 0);
});
```

Remove the "undo restores makeMode after undoing a miss" test entirely (~286–293) — there is no makeMode anymore. (The "undo reverses a 2pt make exactly" test stays; a default-`made` tap still makes.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — the new `made:false` tests fail (current `recordStat` reads `g.makeMode`, ignores `made`), and references to removed makeMode behavior break.

- [ ] **Step 3: Change `recordStat`, `newGame`, `undo`**

In `app.js`, change the `recordStat` signature and shot branch:
```js
function recordStat(game, { team, playerId, stat, modifier, made = true }, nowMs) {
  if (!STAT_TYPES.includes(stat)) return game;

  let g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p) return game;

  const rev = { kind:'stat', team, playerId, fields:{}, score:0, teamFoul:0 };
  let type, detail;
  const mod = modifier ? ` (${modifier})` : '';

  if (SHOT_INFO[stat]) {
    const info = SHOT_INFO[stat];
    p[info.att] += 1; rev.fields[info.att] = 1;
    if (made) {
      p[info.made] += 1; rev.fields[info.made] = 1;
      p.pts += info.pts; g.score[team] += info.pts;
      rev.fields.pts = info.pts; rev.score = info.pts;
      type = stat + '_made';
      detail = `${playerTag(p)} ${info.label}${mod}`;
    } else {
      type = stat + '_miss';
      detail = `${playerTag(p)} missed ${info.label}${mod}`;
    }
  } else if (stat === 'foul') {
    p.pf += 1; rev.fields.pf = 1;
    g.teamFouls[team] += 1; rev.teamFoul = 1;
    type = 'foul';
    detail = `${playerTag(p)} foul${mod}`;
  } else {
    p[stat] += 1; rev.fields[stat] = 1;
    type = stat;
    detail = `${playerTag(p)} ${PLAIN_LABEL[stat]}${mod}`;
  }

  g = pushLog(g, { team, playerId, type, detail, rev }, nowMs);
  return g;
}
```
(The `rev` no longer has `makeModeWas`; the shot branch no longer reads/writes `g.makeMode`.)

In `newGame`, remove the `makeMode: true,` line from the returned object.

In `undo`, remove this line from the `if (rev.kind === 'stat')` branch:
```js
    if (rev.makeModeWas !== null) g.makeMode = rev.makeModeWas;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (all green; shots default to made, `made:false` records a miss, undo reverses it).

- [ ] **Step 5: Shell — remove MAKE/MISS, add the in-DOM menu, rewire**

In `renderControls`, delete the `<div class="makemiss">…</div>` block (the MAKE/MISS buttons). Leave the `.shots` and `.stats` divs as they are for now (Task 3 merges them). The function becomes:
```js
function renderControls(g) {
  const recent = g.log.slice(-10).reverse()
    .map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`)
    .join('');
  return `
    <div class="shots">
      <button data-stat="2pt">2PT</button>
      <button data-stat="3pt">3PT</button>
      <button data-stat="ft">FT</button>
    </div>
    <div class="stats">
      ${['stl','blk','ast','reb','to','foul'].map((s)=>`<button data-stat="${s}">${s.toUpperCase()}</button>`).join('')}
    </div>
    <button id="btn-undo" class="undo">UNDO</button>
    <div class="recent">${recent}</div>
  `;
}
```

In `wireGame`, remove the two MAKE/MISS handler lines:
```js
  $('mm-make') && ($('mm-make').onclick = () => { state.game.makeMode = true; saveGame(); render(); });
  $('mm-miss') && ($('mm-miss').onclick = () => { state.game.makeMode = false; saveGame(); render(); });
```

Replace `recordSelectedStat` with the opts form:
```js
function recordSelectedStat(stat, opts = {}) {
  const g = state.game;
  const team = selectedTeam(g);
  if (!team) return;
  commit((game, now) => recordStat(game, {
    team, playerId: g.selectedPlayerId, stat,
    modifier: opts.modifier ?? null,
    made: opts.made ?? true,
  }, now));
}
```

Replace `attachPressHandlers` so shots and FOUL arm a long-press menu, and a quick tap records a made/plain stat:
```js
function attachPressHandlers(btn, stat) {
  const hasMenu = !!SHOT_INFO[stat] || stat === 'foul';   // shots: Miss(+mods); foul: mods
  let timer = null, longFired = false;
  const start = () => {
    longFired = false;
    if (!hasMenu) return;
    timer = setTimeout(() => { longFired = true; openStatMenu(btn, stat); }, 500);
  };
  const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('touchstart', start, { passive:true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.onclick = () => { if (longFired) { longFired = false; return; } recordSelectedStat(stat); };
}
```

Replace `openModifierMenu` with an in-DOM popover (`openStatMenu` + `closeStatMenu`):
```js
function closeStatMenu() {
  document.querySelectorAll('.popmenu, .popback').forEach((n) => n.remove());
}

function openStatMenu(anchorBtn, stat) {
  closeStatMenu();
  const isShot = !!SHOT_INFO[stat];
  const items = [];
  if (isShot) items.push({ label:'Miss', act:() => recordSelectedStat(stat, { made:false }) });
  (MODIFIERS[stat] || []).forEach((m) =>
    items.push({ label:m, act:() => recordSelectedStat(stat, { made:true, modifier:m }) }));
  if (!items.length) return;

  const back = document.createElement('div');
  back.className = 'popback';
  back.addEventListener('pointerdown', closeStatMenu);

  const menu = document.createElement('div');
  menu.className = 'popmenu';
  items.forEach((it) => {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.addEventListener('click', (e) => { e.stopPropagation(); closeStatMenu(); it.act(); });
    menu.appendChild(b);
  });

  document.body.appendChild(back);
  document.body.appendChild(menu);
  const r = anchorBtn.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8) + 'px';
}
```
(The backdrop closes the menu on an outside tap; option buttons sit above it and are not its descendants, so tapping an option does not trigger the backdrop. `it.act()` calls `recordSelectedStat` → `commit` → `render`.)

Add to `styles.css`:
```css
.popback { position:fixed; inset:0; z-index:50; }
.popmenu { position:fixed; z-index:51; display:flex; flex-direction:column; gap:4px; padding:4px; background:var(--surface); border:1px solid var(--border); border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,.4); }
.popmenu button { padding:10px 16px; font-weight:600; white-space:nowrap; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```

- [ ] **Step 6: Verify Node load + commit**

Run: `node --test` (still green) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js styles.css logic.test.js
git commit -m "feat: tap=made, long-press in-DOM menu (Miss + modifiers); drop makeMode"
```

Manual browser check (deferred): quick-tap 2PT scores; long-press 2PT shows Miss/Layup/Dunk/Mid-range; Miss records an attempt with no points; long-press FT shows just Miss; long-press FOUL shows the foul modifiers; tapping outside the menu closes it.

---

## Task 2: Offensive / defensive rebounds

**Files:**
- Modify: `app.js` (`emptyMyStats`, `STAT_TYPES`, `PLAIN_LABEL`, `boxScore`, `renderControls`)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `recordStat` (generic stat branch), `fmtShot`, `esc`.
- Produces: player stats carry `oreb`/`dreb` (no `reb`); `STAT_TYPES` includes `'oreb','dreb'` (not `'reb'`); the box score shows OREB, DREB, and REB(=oreb+dreb).

- [ ] **Step 1: Update tests to oreb/dreb**

In `logic.test.js`:

In the "empty stat shapes" test (~24), change the expected `emptyMyStats()` object: replace `reb:0,` with `oreb:0, dreb:0,`:
```js
  assert.deepStrictEqual(emptyMyStats(), {
    pts:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, oreb:0, dreb:0, stl:0, blk:0, ast:0, to:0, pf:0,
  });
```

In the "newGame builds initial state keyed by identity" test, change the two rebound assertions (~69, ~71):
```js
  assert.strictEqual(g.myTeam.players[0].oreb, 0);
  assert.strictEqual('dreb' in g.oppTeam.players[0], true);
```

In the Task-8 identity loop, change the `detailed stats attach to my team` test body (~328–329) to use a rebound that now exists:
```js
    g = recordStat(g, { team:'my', playerId:'p1', stat:'oreb' }, 1000);
    assert.strictEqual(g.myTeam.players[0].oreb, 1);
```

Add a focused rebound test (place near the other recordStat tests):
```js
test('offensive and defensive rebounds record separately', () => {
  let g = freshGame();
  g = recordStat(g, { team:'my', playerId:'p1', stat:'oreb' }, 1000);
  g = recordStat(g, { team:'my', playerId:'p1', stat:'dreb' }, 2000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.oreb, 1);
  assert.strictEqual(p.dreb, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `emptyMyStats` still has `reb`, `STAT_TYPES` rejects `'oreb'`/`'dreb'`.

- [ ] **Step 3: Implement oreb/dreb**

In `app.js`:

`emptyMyStats` — replace `reb:0,` with `oreb:0, dreb:0,`:
```js
function emptyMyStats() {
  return { pts:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, oreb:0, dreb:0, stl:0, blk:0, ast:0, to:0, pf:0 };
}
```

`STAT_TYPES` — replace `'reb'` with `'oreb','dreb'`:
```js
const STAT_TYPES = ['2pt','3pt','ft','oreb','dreb','stl','blk','ast','to','foul'];
```

`PLAIN_LABEL` — remove `reb`, add the two:
```js
const PLAIN_LABEL = { oreb:'offensive rebound', dreb:'defensive rebound', stl:'steal', blk:'block', ast:'assist', to:'turnover', foul:'foul' };
```

`boxScore` — add OREB and DREB columns and a REB total. Replace the `cols` array and the rebound cell:
```js
function boxScore(team) {
  const cols = ['PTS','FG','3PT','FT','OREB','DREB','REB','STL','BLK','AST','TO','FLS'];
  const rows = team.players.slice().sort((a,b)=>a.num-b.num).map((p)=>`
    <tr><td>#${p.num} ${esc(p.name||'')}</td>
      <td>${p.pts}</td><td>${fmtShot(p.fgm+p.tpm,p.fga+p.tpa)}</td><td>${fmtShot(p.tpm,p.tpa)}</td>
      <td>${fmtShot(p.ftm,p.fta)}</td><td>${p.oreb}</td><td>${p.dreb}</td><td>${p.oreb+p.dreb}</td>
      <td>${p.stl}</td><td>${p.blk}</td>
      <td>${p.ast}</td><td>${p.to}</td><td>${p.pf}</td></tr>`).join('');
  return `<h2>${esc(team.name)}</h2><table class="bs"><thead><tr><th>Player</th>${cols.map((c)=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}
```

In `renderControls`, replace `'reb'` with `'oreb','dreb'` in the stat-button array:
```js
      ${['oreb','dreb','stl','blk','ast','to','foul'].map((s)=>`<button data-stat="${s}">${s.toUpperCase()}</button>`).join('')}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Verify Node load + commit**

Run: `node -e "require('./app.js'); console.log('loads OK')"`
Expected: `loads OK`.

```bash
git add app.js logic.test.js
git commit -m "feat: split rebounds into OREB/DREB; box score gains OREB/DREB/REB"
```

Manual browser check (deferred): OREB and DREB buttons record to the right player; END GAME → box score shows OREB, DREB, and a REB total.

---

## Task 3: Unified controls grid with UNDO filling the cells beside FOUL

**Files:**
- Modify: `app.js` (`renderControls`), `styles.css`

**Interfaces:**
- Consumes: `g.log`, `periodLabel`, `esc`; the existing `#btn-undo` handler and `[data-stat]` wiring.
- Produces: one 3-column `.grid` holding all shot/stat buttons plus FOUL, with `#btn-undo` spanning the trailing cells of the last row; the recent log scrolls below.

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Merge shots+stats into one grid in `renderControls`**

Replace the `.shots` div, `.stats` div, and the standalone UNDO button with a single grid (keep the `recent` computation and the trailing `.recent` div):
```js
function renderControls(g) {
  const recent = g.log.slice(-10).reverse()
    .map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`)
    .join('');
  return `
    <div class="grid">
      <button data-stat="2pt">2PT</button>
      <button data-stat="3pt">3PT</button>
      <button data-stat="ft">FT</button>
      ${['oreb','dreb','stl','blk','ast','to'].map((s)=>`<button data-stat="${s}">${s.toUpperCase()}</button>`).join('')}
      <button data-stat="foul">FOUL</button>
      <button id="btn-undo" class="undo">UNDO</button>
    </div>
    <div class="recent">${recent}</div>
  `;
}
```
(Button order fills the 3-col grid as: 2PT/3PT/FT · OREB/DREB/STL · BLK/AST/TO · FOUL + UNDO. The 10 stat buttons occupy cells 1–10; UNDO spans the two empty cells beside FOUL.)

- [ ] **Step 2: Replace the old layout CSS with the grid**

In `styles.css`, remove the now-unused `.makemiss …`, `.shots …`, `.stats …`, and the old standalone `.undo { … }` rules, and add:
```css
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
.grid button { padding:12px; font-weight:700; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
.grid .undo { grid-column:span 2; }
```
Keep the `.recent` rule as-is.

> Note: the `.stats button:disabled { opacity:.3; }` rule (if still present) is dead — no stat button is disabled — and may be removed in passing.

- [ ] **Step 3: Verify Node load**

Run: `node --test` (still green — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

- [ ] **Step 4: Commit**

```bash
git add app.js styles.css
git commit -m "feat: unified controls button grid; UNDO fills cells beside FOUL"
```

Manual browser check (deferred): the controls show a single 3-column grid 2PT/3PT/FT · OREB/DREB/STL · BLK/AST/TO · FOUL+UNDO; UNDO spans the gap beside FOUL; all buttons record; recent log scrolls below.

---

## Notes for the implementer

- **Behavior-change TDD (Task 1, Task 2):** update the affected tests to the new expectation first, watch them fail, then change the code. Don't leave contradictory tests behind.
- **Keep `app.js` Node-loadable** after every task (`node -e require`). The new popover code lives inside `openStatMenu`/`closeStatMenu` (called from event handlers), never at module load.
- **`commit` is still the one game-mutation path**; `recordSelectedStat` routes through it.
- **The popover** uses a full-screen backdrop sibling for outside-tap dismissal; option buttons are not descendants of the backdrop, so tapping an option records and closes without the backdrop intercepting it.
