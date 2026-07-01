# Single-File Basketball Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a basketball game scorer as three static files (`index.html`, `styles.css`, `app.js`) that run with no build step, no dependencies, and no network — deployable by committing to GitHub Pages, with all data in `localStorage`.

**Architecture:** All JavaScript lives in `app.js`, split into a **pure-logic layer** (`(state, args) → newState` functions with no DOM/`localStorage` access) and a **shell layer** (DOM rendering, events, persistence) that calls into it. The pure logic is built test-first with Node's built-in test runner; the shell is verified manually in the browser. All per-team state is keyed by identity (`my`/`opp`), never home/away.

**Tech Stack:** Vanilla JavaScript (ES2020+), HTML, CSS. Node.js (only for `node --test`; no `npm install`). No frameworks, no bundler, no TypeScript.

## Global Constraints

- **No runtime dependencies, no build step, no network calls.** The app is exactly `index.html` + `styles.css` + `app.js` served as-is.
- **`app.js` must be `require()`-able by Node without a DOM.** No top-level statement may touch `document`, `window`, or `localStorage`. The browser bootstrap is guarded by `if (typeof document !== "undefined")`; the test export by `if (typeof module !== "undefined")`.
- **Pure-logic functions are deterministic and side-effect-free:** they take all inputs as arguments (including the current time as `nowMs`), never read the clock or storage, and return new state. Use `structuredClone` (available in Node 17+ and modern browsers) to avoid mutating inputs.
- **Per-team state keyed by identity (`my`/`opp`) only.** `config.myTeamSide` is display-only and must never affect stat behavior, persistence, or attribution.
- **My team records full detailed stats + long-press modifiers. Opponent records only points (2PT/3PT/FT) and fouls.**
- **Test runner:** `node --test` with `node:assert`. Test files are `*.test.js` and are never loaded by the page.
- **Targets:** iPhone 16 Safari, portrait. Mobile-first CSS.
- **Defaults:** half length 18 min, number of halves 2, OT length 4 min. Bonus at 7 team fouls, double bonus at 10. Long-press threshold 500ms.

---

## File Structure

- `index.html` — markup only; links `styles.css`, loads `app.js`. Contains the three screen containers (`#setup`, `#game`, `#summary`) and a few static templates.
- `styles.css` — all styling incl. `@media print`.
- `app.js` — pure logic (top) + shell (bottom) + guarded export shim + guarded bootstrap.
- `logic.test.js` — Node tests for the pure-logic layer.
- `README.md` — deploy instructions + manual test checklist.

`app.js` internal section order:
1. Constants (`STAT_TYPES`, `BONUS`, `DOUBLE_BONUS`, defaults).
2. Pure helpers: `clone`, `emptyMyStats`, `emptyOppStats`, `periodLabel`, `bonusState`, `fmtClock`, `parseClock`, `fmtShot`.
3. Pure state: `newGame`, `pushLog` (internal), `recordStat`, `adjustScore`, `togglePossession`, `setPossession`, `recordTimeout`, `endHalf`, `addOvertime`, `endGame`, `undo`, `teamToSave`, `serialize`, `deserialize`.
4. Pure clock: `clockRemaining`, `startClock`, `stopClock`, `toggleClock`, `setClock`.
5. Export shim.
6. Shell: module-level `state`, `save`/`load`, `render*` functions, event wiring, `init`, bootstrap.

---

## Task 1: Project scaffold + test harness

**Files:**
- Create: `index.html`, `styles.css`, `app.js`, `logic.test.js`, `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `app.js` exporting at least `{ VERSION }`; the export shim and guarded bootstrap pattern that every later task relies on.

- [ ] **Step 1: Write the failing test**

`logic.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const app = require('./app.js');

test('app.js is require-able and exports VERSION', () => {
  assert.strictEqual(typeof app, 'object');
  assert.strictEqual(typeof app.VERSION, 'string');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module './app.js'` or `app.VERSION` is undefined.

- [ ] **Step 3: Write minimal implementation**

`app.js`:
```js
'use strict';

const VERSION = '1.0.0';

// ===== EXPORT SHIM (test runner only; browser ignores) =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VERSION };
}

// ===== BOOTSTRAP (browser only; Node ignores) =====
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // init() wired up in a later task
  });
}
```

`index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>HoopScore</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main id="app">
    <section id="setup" hidden></section>
    <section id="game" hidden></section>
    <section id="summary" hidden></section>
  </main>
  <script src="app.js"></script>
</body>
</html>
```

`styles.css`:
```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
[hidden] { display: none !important; }
```

`README.md`:
```md
# HoopScore (single-file basketball scorer)

Static app: `index.html` + `styles.css` + `app.js`. No build, no dependencies.

## Run locally
Open `index.html` in a browser, or serve the folder (e.g. `python -m http.server`).

## Test
`node --test`  (requires Node 17+; no `npm install`)

## Deploy
Commit the three files to a GitHub repo and enable GitHub Pages on the branch.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git init
git add index.html styles.css app.js logic.test.js README.md
git commit -m "chore: scaffold single-file basketball scorer + node test harness"
```

---

## Task 2: Pure helpers + state factory

**Files:**
- Modify: `app.js` (pure helpers + `newGame`)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `clone(obj) → deep copy`
  - `emptyMyStats() → { pts, fgm, fga, tpm, tpa, ftm, fta, reb, stl, blk, ast, to, pf }` (all 0)
  - `emptyOppStats() → { pts, pf }` (all 0)
  - `periodLabel(period, numHalves) → string` ("H1".."H{n}", then "OT1"...)
  - `bonusState(fouls) → "none" | "bonus" | "double"` (>=10 → double, >=7 → bonus)
  - `fmtClock(sec) → "M:SS"`, `parseClock(str) → seconds | null`, `fmtShot(made, att) → "made/att"`
  - `newGame({ config, myTeam, oppTeam }) → game` where `myTeam = { id, name, players:[{id,num,name}] }`, `oppTeam = { name, players:[{id,num,name}] }`. Players are converted to carry stats (`emptyMyStats`/`emptyOppStats`). Initial game: `screen:"game"`, `period:1`, `clock:{ remainingSec: config.halfLengthMin*60, running:false, startedAt:null }`, `score/teamFouls/timeouts: {my:0,opp:0}`, `periodScores:[]`, `possession:"my"`, `log:[]`, `selectedPlayerId:null`, `makeMode:true`, `_seq:0`.

- [ ] **Step 1: Write the failing test**

Add to `logic.test.js`:
```js
const {
  clone, emptyMyStats, emptyOppStats, periodLabel, bonusState,
  fmtClock, parseClock, fmtShot, newGame,
} = app;

test('clone is a deep copy', () => {
  const a = { x: { y: 1 } };
  const b = clone(a);
  b.x.y = 2;
  assert.strictEqual(a.x.y, 1);
});

test('empty stat shapes', () => {
  assert.deepStrictEqual(emptyMyStats(), {
    pts:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, reb:0, stl:0, blk:0, ast:0, to:0, pf:0,
  });
  assert.deepStrictEqual(emptyOppStats(), { pts:0, pf:0 });
});

test('periodLabel', () => {
  assert.strictEqual(periodLabel(1, 2), 'H1');
  assert.strictEqual(periodLabel(2, 2), 'H2');
  assert.strictEqual(periodLabel(3, 2), 'OT1');
  assert.strictEqual(periodLabel(4, 2), 'OT2');
});

test('bonusState thresholds', () => {
  assert.strictEqual(bonusState(6), 'none');
  assert.strictEqual(bonusState(7), 'bonus');
  assert.strictEqual(bonusState(9), 'bonus');
  assert.strictEqual(bonusState(10), 'double');
});

test('clock formatting', () => {
  assert.strictEqual(fmtClock(125), '2:05');
  assert.strictEqual(fmtClock(0), '0:00');
  assert.strictEqual(parseClock('2:05'), 125);
  assert.strictEqual(parseClock('bad'), null);
  assert.strictEqual(fmtShot(3, 7), '3/7');
});

test('newGame builds initial state keyed by identity', () => {
  const g = newGame({
    config: { halfLengthMin:18, numHalves:2, otLengthMin:4, myTeamSide:'home' },
    myTeam: { id:'t1', name:'Mine', players:[{id:'p1', num:5, name:'Smith'}] },
    oppTeam: { name:'Them', players:[{id:'o1', num:9, name:''}] },
  });
  assert.strictEqual(g.screen, 'game');
  assert.strictEqual(g.period, 1);
  assert.strictEqual(g.clock.remainingSec, 18*60);
  assert.strictEqual(g.clock.running, false);
  assert.deepStrictEqual(g.score, { my:0, opp:0 });
  assert.deepStrictEqual(g.periodScores, []);
  assert.strictEqual(g.possession, 'my');
  assert.strictEqual(g.makeMode, true);
  assert.strictEqual(g.myTeam.players[0].pts, 0);   // my players carry full stats
  assert.strictEqual(g.myTeam.players[0].reb, 0);
  assert.strictEqual(g.oppTeam.players[0].pts, 0);  // opp players carry pts+pf only
  assert.strictEqual('reb' in g.oppTeam.players[0], false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `clone is not a function` (and following).

- [ ] **Step 3: Write minimal implementation**

Add to `app.js` above the export shim:
```js
function clone(obj) { return structuredClone(obj); }

function emptyMyStats() {
  return { pts:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, reb:0, stl:0, blk:0, ast:0, to:0, pf:0 };
}
function emptyOppStats() { return { pts:0, pf:0 }; }

function periodLabel(period, numHalves) {
  return period <= numHalves ? 'H' + period : 'OT' + (period - numHalves);
}

const BONUS = 7, DOUBLE_BONUS = 10;
function bonusState(fouls) {
  if (fouls >= DOUBLE_BONUS) return 'double';
  if (fouls >= BONUS) return 'bonus';
  return 'none';
}

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function parseClock(str) {
  const m = /^(\d+):([0-5]?\d)$/.exec(String(str).trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function fmtShot(made, att) { return made + '/' + att; }

function newGame({ config, myTeam, oppTeam }) {
  return {
    screen: 'game',
    config: { ...config },
    myTeam: {
      id: myTeam.id,
      name: myTeam.name,
      players: myTeam.players.map((p) => ({ id:p.id, num:p.num, name:p.name, ...emptyMyStats() })),
    },
    oppTeam: {
      name: oppTeam.name,
      players: oppTeam.players.map((p) => ({ id:p.id, num:p.num, name:p.name, ...emptyOppStats() })),
    },
    period: 1,
    clock: { remainingSec: config.halfLengthMin * 60, running: false, startedAt: null },
    score: { my:0, opp:0 },
    possession: 'my',
    teamFouls: { my:0, opp:0 },
    timeouts: { my:0, opp:0 },
    periodScores: [],
    log: [],
    selectedPlayerId: null,
    makeMode: true,
    _seq: 0,
  };
}
```

Update the export shim object to add these names:
```js
module.exports = {
  VERSION, clone, emptyMyStats, emptyOppStats, periodLabel, bonusState,
  fmtClock, parseClock, fmtShot, newGame,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: pure helpers and newGame state factory"
```

---

## Task 3: Clock pure functions

**Files:**
- Modify: `app.js`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `newGame`, `fmtClock`, `pushLog` (defined here as internal).
- Produces:
  - `clockRemaining(clock, nowMs) → seconds` — if `running && startedAt`, `max(0, remainingSec - floor((nowMs-startedAt)/1000))`; else `remainingSec`.
  - `startClock(game, nowMs) → game` — sets `running:true`, `startedAt:nowMs` (no-op if already running or remaining is 0).
  - `stopClock(game, nowMs) → game` — bakes elapsed into `remainingSec` via `clockRemaining`, sets `running:false`, `startedAt:null` (no-op if not running).
  - `toggleClock(game, nowMs) → game` — start if stopped, stop if running.
  - `setClock(game, seconds, nowMs) → game` — sets `remainingSec:seconds`, `running:false`, `startedAt:null`, appends a `clock_set` log entry (`detail: "Clock set to M:SS"`).
  - `pushLog(game, { team, playerId, type, detail, rev }) → game` (internal) — increments `game._seq`, appends `{ id:_seq, period, clockText: fmtClock(clockRemaining(...)), team, playerId, type, detail, rev }`. For deterministic tests it uses the *baked* `clock.remainingSec` when `startedAt` is null, else needs `nowMs` — so `pushLog` takes `nowMs` as a 2nd arg: `pushLog(game, entry, nowMs)`.

- [ ] **Step 1: Write the failing test**

Add to `logic.test.js`:
```js
const { clockRemaining, startClock, stopClock, toggleClock, setClock } = app;

function freshGame() {
  return newGame({
    config:{ halfLengthMin:18, numHalves:2, otLengthMin:4, myTeamSide:'home' },
    myTeam:{ id:'t1', name:'Mine', players:[{id:'p1',num:5,name:'Smith'}] },
    oppTeam:{ name:'Them', players:[{id:'o1',num:9,name:''}] },
  });
}

test('clockRemaining counts down by real elapsed time', () => {
  const clock = { remainingSec: 100, running: true, startedAt: 1000 };
  assert.strictEqual(clockRemaining(clock, 1000), 100);
  assert.strictEqual(clockRemaining(clock, 6000), 95);   // 5s elapsed
  assert.strictEqual(clockRemaining(clock, 999000), 0);  // never negative
});

test('clockRemaining returns baked value when stopped', () => {
  assert.strictEqual(clockRemaining({ remainingSec: 42, running:false, startedAt:null }, 9e9), 42);
});

test('start then stop bakes elapsed time', () => {
  let g = freshGame();
  g = startClock(g, 1000);
  assert.strictEqual(g.clock.running, true);
  g = stopClock(g, 4000);  // 3s later
  assert.strictEqual(g.clock.running, false);
  assert.strictEqual(g.clock.startedAt, null);
  assert.strictEqual(g.clock.remainingSec, 18*60 - 3);
});

test('toggleClock flips running', () => {
  let g = freshGame();
  g = toggleClock(g, 1000);
  assert.strictEqual(g.clock.running, true);
  g = toggleClock(g, 2000);
  assert.strictEqual(g.clock.running, false);
});

test('setClock sets time, stops, and logs', () => {
  let g = startClock(freshGame(), 1000);
  g = setClock(g, 125, 5000);
  assert.strictEqual(g.clock.remainingSec, 125);
  assert.strictEqual(g.clock.running, false);
  const last = g.log[g.log.length - 1];
  assert.strictEqual(last.type, 'clock_set');
  assert.strictEqual(last.detail, 'Clock set to 2:05');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `clockRemaining is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `app.js`:
```js
function clockRemaining(clock, nowMs) {
  if (clock.running && clock.startedAt != null) {
    const elapsed = Math.floor((nowMs - clock.startedAt) / 1000);
    return Math.max(0, clock.remainingSec - elapsed);
  }
  return clock.remainingSec;
}

function pushLog(game, entry, nowMs) {
  const g = clone(game);
  g._seq += 1;
  g.log.push({
    id: g._seq,
    period: g.period,
    clockText: fmtClock(clockRemaining(g.clock, nowMs)),
    team: entry.team ?? null,
    playerId: entry.playerId ?? null,
    type: entry.type,
    detail: entry.detail ?? '',
    rev: entry.rev ?? null,
  });
  return g;
}

function startClock(game, nowMs) {
  if (game.clock.running || game.clock.remainingSec <= 0) return game;
  const g = clone(game);
  g.clock.running = true;
  g.clock.startedAt = nowMs;
  return g;
}

function stopClock(game, nowMs) {
  if (!game.clock.running) return game;
  const g = clone(game);
  g.clock.remainingSec = clockRemaining(game.clock, nowMs);
  g.clock.running = false;
  g.clock.startedAt = null;
  return g;
}

function toggleClock(game, nowMs) {
  return game.clock.running ? stopClock(game, nowMs) : startClock(game, nowMs);
}

function setClock(game, seconds, nowMs) {
  let g = clone(game);
  g.clock.remainingSec = Math.max(0, Math.floor(seconds));
  g.clock.running = false;
  g.clock.startedAt = null;
  g = pushLog(g, { type:'clock_set', detail:'Clock set to ' + fmtClock(g.clock.remainingSec) }, nowMs);
  return g;
}
```

Add to the export object: `clockRemaining, startClock, stopClock, toggleClock, setClock` (keep `pushLog` internal — not exported).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: wall-clock-based timer pure functions"
```

---

## Task 4: Stat recording (recordStat)

**Files:**
- Modify: `app.js`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `pushLog`, `clockRemaining`.
- Produces:
  - `STAT_TYPES` constant: `{ MY: ['2pt','3pt','ft','reb','stl','blk','ast','to','foul'], OPP: ['2pt','3pt','ft','foul'] }`.
  - `findPlayer(team, playerId) → player | null` (internal).
  - `recordStat(game, { team, playerId, stat, modifier }, nowMs) → game` where `team` is `"my"|"opp"`, `stat` is one of the type strings. Rules:
    - If `team==='opp'` and `stat` not in `STAT_TYPES.OPP` → return game unchanged.
    - Shots (`2pt`/`3pt`/`ft`): `made = team==='opp' ? true : game.makeMode`. On make, increment makes+attempts and add points to player.pts and `score[team]`; on miss, increment attempts only. After a **miss** for `my`, reset `makeMode:true`.
    - `2pt`: fgm/fga (+2 pts); `3pt`: tpm/tpa (+3 pts); `ft`: ftm/fta (+1 pt).
    - `reb/stl/blk/ast/to`: +1 to that field (my only).
    - `foul`: player.pf +1 and `teamFouls[team]` +1 (both teams).
    - Append a log entry with `type` (e.g. `'2pt_made'`, `'2pt_miss'`, `'foul'`, `'reb'`…), a human `detail` (`#<num> <name> <label><(modifier)>`), and a `rev` payload (see below) for undo.
  - `rev` shape for stat: `{ kind:'stat', team, playerId, fields:{<field>:+n,...}, score:+n, teamFoul:+n, makeModeWas:<bool|null> }`. (Inverse is applied by `undo` in Task 7.)

- [ ] **Step 1: Write the failing test**

Add to `logic.test.js`:
```js
const { recordStat } = app;

test('my 2pt make adds points and field goal make/attempt', () => {
  let g = freshGame();
  g = recordStat(g, { team:'my', playerId:'p1', stat:'2pt' }, 1000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.pts, 2);
  assert.strictEqual(p.fgm, 1);
  assert.strictEqual(p.fga, 1);
  assert.strictEqual(g.score.my, 2);
  assert.strictEqual(g.log[0].type, '2pt_made');
});

test('miss records attempt only and resets makeMode', () => {
  let g = freshGame();
  g.makeMode = false;
  g = recordStat(g, { team:'my', playerId:'p1', stat:'3pt' }, 1000);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.tpm, 0);
  assert.strictEqual(p.tpa, 1);
  assert.strictEqual(p.pts, 0);
  assert.strictEqual(g.score.my, 0);
  assert.strictEqual(g.makeMode, true);   // auto-reset to MAKE
  assert.strictEqual(g.log[0].type, '3pt_miss');
});

test('foul increments player pf and team fouls', () => {
  let g = freshGame();
  g = recordStat(g, { team:'my', playerId:'p1', stat:'foul', modifier:'Shooting' }, 1000);
  assert.strictEqual(g.myTeam.players[0].pf, 1);
  assert.strictEqual(g.teamFouls.my, 1);
  assert.match(g.log[0].detail, /foul \(Shooting\)/);
});

test('opponent can only score and foul', () => {
  let g = freshGame();
  g = recordStat(g, { team:'opp', playerId:'o1', stat:'3pt' }, 1000);
  assert.strictEqual(g.oppTeam.players[0].pts, 3);
  assert.strictEqual(g.score.opp, 3);
  const before = clone(g);
  g = recordStat(g, { team:'opp', playerId:'o1', stat:'reb' }, 2000);  // invalid for opp
  assert.deepStrictEqual(g, before);   // unchanged
});

test('opponent shots are always makes regardless of makeMode', () => {
  let g = freshGame();
  g.makeMode = false;
  g = recordStat(g, { team:'opp', playerId:'o1', stat:'2pt' }, 1000);
  assert.strictEqual(g.score.opp, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `recordStat is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `app.js`:
```js
const STAT_TYPES = {
  MY: ['2pt','3pt','ft','reb','stl','blk','ast','to','foul'],
  OPP: ['2pt','3pt','ft','foul'],
};
const SHOT_INFO = {
  '2pt': { made:'fgm', att:'fga', pts:2, label:'2PT' },
  '3pt': { made:'tpm', att:'tpa', pts:3, label:'3PT' },
  'ft':  { made:'ftm', att:'fta', pts:1, label:'FT' },
};
const PLAIN_LABEL = { reb:'rebound', stl:'steal', blk:'block', ast:'assist', to:'turnover', foul:'foul' };

function findPlayer(team, playerId) {
  return team.players.find((p) => p.id === playerId) ?? null;
}

function playerTag(p) {
  return p.name && !p.name.startsWith('#') ? `#${p.num} ${p.name}` : `#${p.num}`;
}

function recordStat(game, { team, playerId, stat, modifier }, nowMs) {
  const allowed = team === 'opp' ? STAT_TYPES.OPP : STAT_TYPES.MY;
  if (!allowed.includes(stat)) return game;

  let g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = findPlayer(t, playerId);
  if (!p) return game;

  const rev = { kind:'stat', team, playerId, fields:{}, score:0, teamFoul:0, makeModeWas:null };
  let type, detail;
  const mod = modifier ? ` (${modifier})` : '';

  if (SHOT_INFO[stat]) {
    const info = SHOT_INFO[stat];
    const made = team === 'opp' ? true : g.makeMode;
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
      if (team === 'my' && g.makeMode === false) { rev.makeModeWas = false; g.makeMode = true; }
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

Add to export object: `recordStat, STAT_TYPES`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: stat recording for my team (detailed) and opponent (pts+fouls)"
```

---

## Task 5: Score adjust, possession, timeout

**Files:**
- Modify: `app.js`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `pushLog`, `stopClock`.
- Produces:
  - `adjustScore(game, team, delta, nowMs) → game` — `score[team] = max(0, score[team]+delta)`; log `type:'score_adj'`, `detail` like `"<TeamName> score +1"`; `rev:{ kind:'score', team, score: appliedDelta }` (applied delta accounts for clamping).
  - `togglePossession(game, nowMs) → game` — flips `my`↔`opp`; log `type:'possession'`; `rev:{ kind:'possession', prev }`.
  - `setPossession(game, team) → game` — sets without logging (used at game start / OT).
  - `recordTimeout(game, team, nowMs) → game` — `timeouts[team]+1`, **auto-stop clock** (`stopClock`), log `type:'timeout'`; `rev:{ kind:'timeout', team }` (undo restores count only; clock is not un-stopped).
  - `teamDisplayName(game, team) → string` (internal helper: `team==='my' ? myTeam.name : oppTeam.name`).

- [ ] **Step 1: Write the failing test**

```js
const { adjustScore, togglePossession, setPossession, recordTimeout } = app;

test('adjustScore clamps at zero and logs applied delta', () => {
  let g = freshGame();
  g = adjustScore(g, 'my', 3, 1000);
  assert.strictEqual(g.score.my, 3);
  g = adjustScore(g, 'my', -5, 2000);
  assert.strictEqual(g.score.my, 0);
  const last = g.log[g.log.length-1];
  assert.strictEqual(last.type, 'score_adj');
  assert.strictEqual(last.rev.score, -3);   // only -3 actually applied
});

test('togglePossession flips and logs', () => {
  let g = freshGame();
  assert.strictEqual(g.possession, 'my');
  g = togglePossession(g, 1000);
  assert.strictEqual(g.possession, 'opp');
  assert.strictEqual(g.log[0].type, 'possession');
});

test('setPossession does not log', () => {
  let g = setPossession(freshGame(), 'opp');
  assert.strictEqual(g.possession, 'opp');
  assert.strictEqual(g.log.length, 0);
});

test('recordTimeout increments and stops the clock', () => {
  let g = startClock(freshGame(), 1000);
  g = recordTimeout(g, 'opp', 3000);
  assert.strictEqual(g.timeouts.opp, 1);
  assert.strictEqual(g.clock.running, false);
  assert.strictEqual(g.log[g.log.length-1].type, 'timeout');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `adjustScore is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
function teamDisplayName(game, team) {
  return team === 'my' ? game.myTeam.name : game.oppTeam.name;
}

function adjustScore(game, team, delta, nowMs) {
  let g = clone(game);
  const next = Math.max(0, g.score[team] + delta);
  const applied = next - g.score[team];
  g.score[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(g, {
    team, type:'score_adj',
    detail: `${teamDisplayName(g, team)} score ${sign}`,
    rev: { kind:'score', team, score: applied },
  }, nowMs);
  return g;
}

function togglePossession(game, nowMs) {
  let g = clone(game);
  const prev = g.possession;
  g.possession = prev === 'my' ? 'opp' : 'my';
  g = pushLog(g, {
    type:'possession',
    detail: `Possession: ${teamDisplayName(g, g.possession)}`,
    rev: { kind:'possession', prev },
  }, nowMs);
  return g;
}

function setPossession(game, team) {
  const g = clone(game);
  g.possession = team;
  return g;
}

function recordTimeout(game, team, nowMs) {
  let g = stopClock(game, nowMs);
  g = clone(g);
  g.timeouts[team] += 1;
  g = pushLog(g, {
    team, type:'timeout',
    detail: `${teamDisplayName(g, team)} timeout`,
    rev: { kind:'timeout', team },
  }, nowMs);
  return g;
}
```

Add to export object: `adjustScore, togglePossession, setPossession, recordTimeout`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: score adjust, possession toggle, timeout"
```

---

## Task 6: Period transitions + period-score snapshots

**Files:**
- Modify: `app.js`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `pushLog`, `stopClock`, `setPossession`, `periodLabel`.
- Produces:
  - `snapshotPeriod(game) → game` (internal) — pushes `{ my:score.my, opp:score.opp }` onto `periodScores`.
  - `endHalf(game, nowMs) → game` — only meaningful when `period < numHalves`. Stops clock, snapshots period, `period+1`, resets `clock.remainingSec` to `halfLengthMin*60` (stopped), resets `teamFouls` to `{my:0,opp:0}`, logs `type:'end_period'`. (Does not change possession.)
  - `addOvertime(game, nowMs) → game` — stops clock, snapshots period, `period+1`, `clock.remainingSec = otLengthMin*60` (stopped), resets `teamFouls`, **toggles possession** (via `setPossession` to the opposite), logs `type:'end_period'` with OT detail.
  - `endGame(game, nowMs) → game` — stops clock, snapshots period, sets `screen:'summary'`, logs `type:'end_game'`.
  - All read lengths from `game.config` (`halfLengthMin`, `otLengthMin`, `numHalves`).

- [ ] **Step 1: Write the failing test**

```js
const { endHalf, addOvertime, endGame } = app;

test('endHalf advances period, resets clock and team fouls, snapshots score', () => {
  let g = freshGame();
  g = adjustScore(g, 'my', 30, 1000);
  g = adjustScore(g, 'opp', 25, 1000);
  g.teamFouls = { my:5, opp:6 };
  g = endHalf(g, 2000);
  assert.strictEqual(g.period, 2);
  assert.strictEqual(g.clock.remainingSec, 18*60);
  assert.deepStrictEqual(g.teamFouls, { my:0, opp:0 });
  assert.deepStrictEqual(g.periodScores[0], { my:30, opp:25 });
  assert.strictEqual(g.log[g.log.length-1].type, 'end_period');
});

test('addOvertime sets OT clock and toggles possession', () => {
  let g = freshGame();
  g.period = 2;
  g.possession = 'my';
  g = addOvertime(g, 1000);
  assert.strictEqual(g.period, 3);                 // OT1
  assert.strictEqual(g.clock.remainingSec, 4*60);
  assert.strictEqual(g.possession, 'opp');
  assert.deepStrictEqual(g.teamFouls, { my:0, opp:0 });
});

test('endGame moves to summary and snapshots final period', () => {
  let g = freshGame();
  g.period = 2;
  g = adjustScore(g, 'my', 50, 1000);
  g = endGame(g, 2000);
  assert.strictEqual(g.screen, 'summary');
  assert.deepStrictEqual(g.periodScores[g.periodScores.length-1], { my:50, opp:0 });
  assert.strictEqual(g.log[g.log.length-1].type, 'end_game');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `endHalf is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
function snapshotPeriod(game) {
  const g = clone(game);
  g.periodScores.push({ my: g.score.my, opp: g.score.opp });
  return g;
}

function endHalf(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.halfLengthMin * 60, running:false, startedAt:null };
  g.teamFouls = { my:0, opp:0 };
  g = pushLog(g, { type:'end_period', detail:`End of ${label}` }, nowMs);
  return g;
}

function addOvertime(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = snapshotPeriod(g);
  const label = periodLabel(g.period, g.config.numHalves);
  g.period += 1;
  g.clock = { remainingSec: g.config.otLengthMin * 60, running:false, startedAt:null };
  g.teamFouls = { my:0, opp:0 };
  g = setPossession(g, g.possession === 'my' ? 'opp' : 'my');
  g = pushLog(g, { type:'end_period', detail:`End of ${label} — overtime` }, nowMs);
  return g;
}

function endGame(game, nowMs) {
  let g = stopClock(game, nowMs);
  g = snapshotPeriod(g);
  g.screen = 'summary';
  g = pushLog(g, { type:'end_game', detail:'Final' }, nowMs);
  return g;
}
```

Add to export object: `endHalf, addOvertime, endGame`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: period transitions, overtime, end game with period snapshots"
```

---

## Task 7: Undo

**Files:**
- Modify: `app.js`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, all `rev` payloads produced in Tasks 4–5.
- Produces:
  - `undo(game) → game` — pops the last log entry and applies the inverse of its `rev`. Supported `rev.kind`: `'stat'`, `'score'`, `'possession'`, `'timeout'`. For an entry with no reversible `rev` (e.g. `clock_set`, `end_period`, `end_game`, or empty log) → return game unchanged. Inverse rules:
    - `stat`: subtract each `fields[field]` from the player; subtract `rev.score` from `score[team]`; subtract `rev.teamFoul` from `teamFouls[team]`; if `makeModeWas !== null`, restore `game.makeMode = makeModeWas`.
    - `score`: `score[team] -= rev.score`.
    - `possession`: `possession = rev.prev`.
    - `timeout`: `timeouts[team] -= 1`.

- [ ] **Step 1: Write the failing test**

```js
const { undo } = app;

test('undo reverses a 2pt make exactly', () => {
  let g = freshGame();
  g = recordStat(g, { team:'my', playerId:'p1', stat:'2pt' }, 1000);
  g = undo(g);
  const p = g.myTeam.players[0];
  assert.strictEqual(p.pts, 0);
  assert.strictEqual(p.fgm, 0);
  assert.strictEqual(p.fga, 0);
  assert.strictEqual(g.score.my, 0);
  assert.strictEqual(g.log.length, 0);
});

test('undo restores makeMode after undoing a miss', () => {
  let g = freshGame();
  g.makeMode = false;
  g = recordStat(g, { team:'my', playerId:'p1', stat:'2pt' }, 1000); // miss, resets makeMode→true
  assert.strictEqual(g.makeMode, true);
  g = undo(g);
  assert.strictEqual(g.makeMode, false);
  assert.strictEqual(g.myTeam.players[0].fga, 0);
});

test('sequential undo peels actions in reverse', () => {
  let g = freshGame();
  g = recordStat(g, { team:'my', playerId:'p1', stat:'foul' }, 1000);
  g = recordStat(g, { team:'my', playerId:'p1', stat:'2pt' }, 2000);
  g = undo(g);  // undo the 2pt
  assert.strictEqual(g.score.my, 0);
  assert.strictEqual(g.myTeam.players[0].pf, 1);   // foul still there
  g = undo(g);  // undo the foul
  assert.strictEqual(g.myTeam.players[0].pf, 0);
  assert.strictEqual(g.teamFouls.my, 0);
});

test('undo on empty / non-reversible log is a no-op', () => {
  let g = freshGame();
  assert.deepStrictEqual(undo(g), g);
  g = setClock(g, 100, 1000);   // clock_set has no rev
  assert.deepStrictEqual(undo(g).clock.remainingSec, 100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `undo is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
function undo(game) {
  if (game.log.length === 0) return game;
  const last = game.log[game.log.length - 1];
  const rev = last.rev;
  if (!rev) return game;

  const g = clone(game);
  g.log.pop();

  if (rev.kind === 'stat') {
    const t = rev.team === 'my' ? g.myTeam : g.oppTeam;
    const p = findPlayer(t, rev.playerId);
    if (p) for (const [field, n] of Object.entries(rev.fields)) p[field] -= n;
    g.score[rev.team] -= rev.score;
    g.teamFouls[rev.team] -= rev.teamFoul;
    if (rev.makeModeWas !== null) g.makeMode = rev.makeModeWas;
  } else if (rev.kind === 'score') {
    g.score[rev.team] -= rev.score;
  } else if (rev.kind === 'possession') {
    g.possession = rev.prev;
  } else if (rev.kind === 'timeout') {
    g.timeouts[rev.team] -= 1;
  }
  return g;
}
```

Add to export object: `undo`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: undo via per-entry reversal payloads"
```

---

## Task 8: Team-identity regression guard + saved-team write-back

**Files:**
- Modify: `app.js`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `recordStat`, `newGame`, `STAT_TYPES`.
- Produces:
  - `teamToSave(game) → { id, name, players:[{id,num,name}] }` — returns **`myTeam`** reduced to roster fields (strips stats), regardless of `config.myTeamSide`. It expresses, at the logic layer, the invariant that "the saved team is always my team, never the home/left slot." (The Setup shell writes the roster inline from the draft, which is correct by construction; this helper + its tests are the executable guarantee of the invariant.)

- [ ] **Step 1: Write the failing test**

```js
const { teamToSave } = app;

function gameWithSide(side) {
  return newGame({
    config:{ halfLengthMin:18, numHalves:2, otLengthMin:4, myTeamSide:side },
    myTeam:{ id:'mine', name:'Mine', players:[{id:'p1',num:5,name:'Smith'}] },
    oppTeam:{ name:'Them', players:[{id:'o1',num:9,name:''}] },
  });
}

for (const side of ['home', 'away']) {
  test(`detailed stats attach to my team when myTeamSide=${side}`, () => {
    let g = gameWithSide(side);
    g = recordStat(g, { team:'my', playerId:'p1', stat:'reb' }, 1000);   // detailed-only stat
    assert.strictEqual(g.myTeam.players[0].reb, 1);
  });

  test(`opponent limited to pts+fouls when myTeamSide=${side}`, () => {
    let g = gameWithSide(side);
    const before = clone(g);
    g = recordStat(g, { team:'opp', playerId:'o1', stat:'blk' }, 1000); // not allowed for opp
    assert.deepStrictEqual(g, before);
  });

  test(`teamToSave returns my team roster when myTeamSide=${side}`, () => {
    const g = gameWithSide(side);
    assert.deepStrictEqual(teamToSave(g), {
      id:'mine', name:'Mine', players:[{ id:'p1', num:5, name:'Smith' }],
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `teamToSave is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
function teamToSave(game) {
  return {
    id: game.myTeam.id,
    name: game.myTeam.name,
    players: game.myTeam.players.map((p) => ({ id:p.id, num:p.num, name:p.name })),
  };
}
```

Add to export object: `teamToSave`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (6 new assertions across both sides).

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "test: regression guard that team identity is independent of side"
```

---

## Task 9: Serialize / deserialize (persistence core)

**Files:**
- Modify: `app.js`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `serialize(value) → string` — `JSON.stringify`.
  - `deserialize(str) → value | null` — `JSON.parse` wrapped in try/catch; returns `null` on bad input.
  - `isResumable(game) → boolean` — `true` when `game && game.screen === 'game'`.

- [ ] **Step 1: Write the failing test**

```js
const { serialize, deserialize, isResumable } = app;

test('serialize/deserialize round-trips a game', () => {
  const g = freshGame();
  assert.deepStrictEqual(deserialize(serialize(g)), g);
});

test('deserialize returns null on garbage', () => {
  assert.strictEqual(deserialize('{not json'), null);
  assert.strictEqual(deserialize(null), null);
});

test('isResumable only for in-progress game screen', () => {
  assert.strictEqual(isResumable(freshGame()), true);             // screen:'game'
  assert.strictEqual(isResumable({ screen:'summary' }), false);
  assert.strictEqual(isResumable(null), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `serialize is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
function serialize(value) { return JSON.stringify(value); }
function deserialize(str) {
  try { return str == null ? null : JSON.parse(str); }
  catch { return null; }
}
function isResumable(game) { return !!game && game.screen === 'game'; }
```

Add to export object: `serialize, deserialize, isResumable`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: serialize/deserialize and resumable check"
```

---

## Task 10: Shell foundation — state, persistence, screen routing, bootstrap

**Files:**
- Modify: `app.js` (shell section, after export shim), `index.html`, `styles.css`

**Interfaces:**
- Consumes: `serialize`, `deserialize`, `isResumable`.
- Produces (shell, not exported/tested): module-level `state = { teams: [], game: null }`; `KEYS = { teams:'hoops.teams', game:'hoops.game' }`; `saveTeams()`, `saveGame()`, `loadAll()`, `showScreen(name)`, `render()`, `init()`.

> **Verification for this and all later shell tasks is manual in the browser** (per spec; shell is not unit-tested). Each task lists explicit manual steps.

- [ ] **Step 1: Add shell foundation to `app.js`** (below the export shim, inside the `if (typeof document !== 'undefined')`-guarded region, but define functions at module scope and only *call* `init` in the bootstrap)

```js
// ===== SHELL =====
const KEYS = { teams: 'hoops.teams', game: 'hoops.game' };
let state = { teams: [], game: null };

function saveTeams() { localStorage.setItem(KEYS.teams, serialize(state.teams)); }
function saveGame() {
  if (state.game) localStorage.setItem(KEYS.game, serialize(state.game));
  else localStorage.removeItem(KEYS.game);
}
function loadAll() {
  state.teams = deserialize(localStorage.getItem(KEYS.teams)) || [];
  state.game = deserialize(localStorage.getItem(KEYS.game));
}

const screens = ['setup', 'game', 'summary'];
function showScreen(name) {
  for (const s of screens) document.getElementById(s).hidden = (s !== name);
}

function render() {
  if (state.game && state.game.screen === 'game') { showScreen('game'); renderGame(); }
  else if (state.game && state.game.screen === 'summary') { showScreen('summary'); renderSummary(); }
  else { showScreen('setup'); renderSetup(); }
}

// Placeholder renderers replaced in later tasks:
function renderSetup() {}
function renderGame() {}
function renderSummary() {}

function init() {
  loadAll();
  render();
}
```

Update the bootstrap block to call `init`:
```js
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
```

- [ ] **Step 2: Verify the export still loads in Node**

Run: `node --test`
Expected: PASS (shell code is defined but `init` is only called on `DOMContentLoaded`, which never fires in Node).

- [ ] **Step 3: Manual browser check**

Open `index.html`. Open devtools console.
Expected: no errors; the Setup section is visible (others hidden). `localStorage` has no `hoops.*` keys yet.

- [ ] **Step 4: Commit**

```bash
git add app.js index.html styles.css
git commit -m "feat: shell foundation — state, persistence, screen routing, bootstrap"
```

---

## Task 11: Setup screen (render + interactions + resume banner)

**Files:**
- Modify: `app.js` (`renderSetup` and setup handlers), `styles.css`

**Interfaces:**
- Consumes: `newGame`, `setPossession`, `toggleClock`, `isResumable`, `periodLabel`, `clockRemaining`, `fmtClock`, `saveTeams`, `saveGame`, `render`.
- Produces: `startGame(tipWinner)`, `resumeGame()`, `discardGame()`, plus setup-local draft handling. A started game's config carries `myTeamSide` and the chosen first possession.

- [ ] **Step 1: Implement `renderSetup` and handlers in `app.js`**

```js
// --- Setup screen state (draft, lives only while on setup) ---
let setupDraft = null;
function defaultDraft() {
  return {
    myTeamId: state.teams[0]?.id ?? null,
    newTeam: state.teams.length === 0,   // first run forces "new team"
    newTeamName: '',
    myPlayers: state.teams[0] ? clone(state.teams[0].players) : [],
    oppName: '',
    oppPlayers: [],
    halfLengthMin: 18, numHalves: 2, otLengthMin: 4,
    myTeamSide: 'home',
  };
}

function makeLocalId() {
  return 'id' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function renderSetup() {
  if (!setupDraft) setupDraft = defaultDraft();
  const d = setupDraft;
  const el = document.getElementById('setup');
  const resumable = isResumable(state.game);
  const banner = resumable ? `
    <div class="resume-banner">
      Resume ${esc(state.game.myTeam.name)} vs ${esc(state.game.oppTeam.name)} —
      ${periodLabel(state.game.period, state.game.config.numHalves)}
      ${fmtClock(clockRemaining(state.game.clock, Date.now()))}
      <div class="resume-actions">
        <button id="btn-resume">Resume</button>
        <button id="btn-discard" class="danger">Discard</button>
      </div>
    </div>` : '';

  el.innerHTML = `
    ${banner}
    <h1>HoopScore</h1>
    <section class="card">
      <h2>My Team</h2>
      ${state.teams.length ? `
        <label>Saved team
          <select id="my-team-select">
            <option value="__new">+ New team</option>
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id===d.myTeamId&&!d.newTeam?'selected':''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>` : ''}
      ${d.newTeam ? `<label>Team name <input id="new-team-name" value="${esc(d.newTeamName)}" placeholder="e.g. Lakers"></label>` : ''}
      <div id="my-players">${renderRoster(d.myPlayers, 'my')}</div>
      <div class="add-player">
        <input id="my-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="my-add-name" placeholder="Name (optional)">
        <button id="my-add-btn">Add</button>
      </div>
    </section>

    <section class="card">
      <h2>Opponent</h2>
      <label>Opponent name <input id="opp-name" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
      <div id="opp-players">${renderRoster(d.oppPlayers, 'opp')}</div>
      <div class="add-player">
        <input id="opp-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="opp-add-name" placeholder="Name (optional)">
        <button id="opp-add-btn">Add</button>
      </div>
    </section>

    <details class="card">
      <summary>Settings</summary>
      <label>Half length (min) <input id="half-len" type="number" value="${d.halfLengthMin}"></label>
      <label>Number of halves <input id="num-halves" type="number" value="${d.numHalves}"></label>
      <label>OT length (min) <input id="ot-len" type="number" value="${d.otLengthMin}"></label>
    </details>

    <section class="card">
      <h2>My team is</h2>
      <div class="toggle">
        <button class="${d.myTeamSide==='home'?'active':''}" data-side="home">Home</button>
        <button class="${d.myTeamSide==='away'?'active':''}" data-side="away">Away</button>
      </div>
    </section>

    <section class="card">
      <h2>Who won the tip?</h2>
      <div class="tip-row">
        <button class="tip" data-tip="my">${esc(d.newTeam ? (d.newTeamName||'My Team') : (currentMyTeamName(d)||'My Team'))}</button>
        <button class="tip" data-tip="opp">${esc(d.oppName||'Opponent')}</button>
      </div>
      <p id="setup-error" class="error"></p>
    </section>
  `;
  wireSetup();
}

function currentMyTeamName(d) {
  const t = state.teams.find((x) => x.id === d.myTeamId);
  return t ? t.name : '';
}

function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">No players yet</p>`;
  return `<ul class="roster">` + players.map((p, i) =>
    `<li>#${p.num} ${esc(p.name || '')}<button data-rm="${which}:${i}" class="rm">×</button></li>`
  ).join('') + `</ul>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
```

- [ ] **Step 2: Implement `wireSetup`, add/remove players, start/resume/discard**

```js
function wireSetup() {
  const d = setupDraft;
  const $ = (id) => document.getElementById(id);

  $('btn-resume') && ($('btn-resume').onclick = resumeGame);
  $('btn-discard') && ($('btn-discard').onclick = discardGame);

  const sel = $('my-team-select');
  if (sel) sel.onchange = () => {
    if (sel.value === '__new') { d.newTeam = true; d.myTeamId = null; d.myPlayers = []; }
    else {
      d.newTeam = false; d.myTeamId = sel.value;
      d.myPlayers = clone(state.teams.find((t) => t.id === sel.value).players);
    }
    renderSetup();
  };
  $('new-team-name') && ($('new-team-name').oninput = (e) => { d.newTeamName = e.target.value; });
  $('opp-name') && ($('opp-name').oninput = (e) => { d.oppName = e.target.value; });

  $('my-add-btn').onclick = () => addPlayer('my', $('my-add-num'), $('my-add-name'));
  $('opp-add-btn').onclick = () => addPlayer('opp', $('opp-add-num'), $('opp-add-name'));
  $('my-add-num').onkeydown = (e) => { if (e.key === 'Enter') $('my-add-btn').click(); };
  $('opp-add-num').onkeydown = (e) => { if (e.key === 'Enter') $('opp-add-btn').click(); };

  for (const len of ['half-len','num-halves','ot-len']) {
    const map = { 'half-len':'halfLengthMin','num-halves':'numHalves','ot-len':'otLengthMin' };
    $(len) && ($(len).oninput = (e) => { d[map[len]] = parseInt(e.target.value,10) || d[map[len]]; });
  }

  el_each('[data-side]', (b) => b.onclick = () => { d.myTeamSide = b.dataset.side; renderSetup(); });
  el_each('[data-rm]', (b) => b.onclick = () => {
    const [which, i] = b.dataset.rm.split(':');
    (which==='my'?d.myPlayers:d.oppPlayers).splice(parseInt(i,10),1);
    renderSetup();
  });
  el_each('[data-tip]', (b) => b.onclick = () => startGame(b.dataset.tip));
}

function el_each(sel, fn) { document.querySelectorAll(sel).forEach(fn); }

function addPlayer(which, numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  const list = which==='my' ? setupDraft.myPlayers : setupDraft.oppPlayers;
  list.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
}

function startGame(tipWinner) {
  const d = setupDraft;
  const err = document.getElementById('setup-error');
  const myName = d.newTeam ? d.newTeamName.trim() : currentMyTeamName(d);
  if (!myName) { err.textContent = 'Enter your team name.'; return; }
  if (!d.oppName.trim()) { err.textContent = 'Enter the opponent name.'; return; }
  if (!d.myPlayers.length || !d.oppPlayers.length) { err.textContent = 'Add players to both teams.'; return; }

  // Persist a new team to saved teams (or update the selected one)
  let myTeamId = d.myTeamId;
  if (d.newTeam) {
    myTeamId = makeLocalId();
    state.teams.push({ id: myTeamId, name: myName, players: clone(d.myPlayers) });
  } else {
    const t = state.teams.find((x) => x.id === myTeamId);
    if (t) { t.name = myName; t.players = clone(d.myPlayers); }
  }
  saveTeams();

  let g = newGame({
    config: { halfLengthMin:d.halfLengthMin, numHalves:d.numHalves, otLengthMin:d.otLengthMin, myTeamSide:d.myTeamSide },
    myTeam: { id: myTeamId, name: myName, players: d.myPlayers },
    oppTeam: { name: d.oppName.trim(), players: d.oppPlayers },
  });
  g = setPossession(g, tipWinner);
  g = toggleClock(g, Date.now());   // tip-off starts the clock
  state.game = g;
  setupDraft = null;
  saveGame();
  render();
}

function resumeGame() { render(); }   // state.game already screen:'game'
function discardGame() {
  if (!confirm('Discard the in-progress game? This cannot be undone.')) return;
  state.game = null;
  saveGame();
  setupDraft = defaultDraft();
  render();
}
```

- [ ] **Step 3: Add setup styles to `styles.css`**

```css
#setup { padding: 16px; max-width: 640px; margin: 0 auto; }
.card { background:#f5f5f5; border-radius:12px; padding:12px 14px; margin-bottom:16px; }
.card h2 { margin:0 0 8px; font-size:1rem; }
.card label { display:block; margin:8px 0; font-size:.9rem; }
.card input, .card select { width:100%; padding:10px; font-size:1rem; border:1px solid #ccc; border-radius:8px; }
.add-player { display:flex; gap:8px; margin-top:8px; }
.add-player .num { width:64px; } .add-player button { padding:0 16px; }
.roster { list-style:none; padding:0; margin:8px 0; }
.roster li { display:flex; justify-content:space-between; padding:6px 8px; background:#fff; border-radius:6px; margin-bottom:4px; }
.toggle, .tip-row { display:flex; gap:8px; }
.toggle button, .tip-row .tip { flex:1; padding:12px; border:1px solid #f59e0b; background:#fff; border-radius:8px; font-weight:600; }
.toggle button.active { background:#f59e0b; color:#fff; }
.tip-row .tip { background:#f59e0b; color:#fff; min-height:52px; }
.resume-banner { background:#fff7ed; border:1px solid #f59e0b; border-radius:12px; padding:12px; margin-bottom:16px; }
.resume-actions { display:flex; gap:8px; margin-top:8px; }
.resume-actions .danger { background:#dc2626; color:#fff; border:none; border-radius:8px; padding:8px 12px; }
.error { color:#dc2626; min-height:1.2em; } .muted { color:#888; } .rm { border:none; background:none; color:#dc2626; font-size:1.1rem; }
```

- [ ] **Step 4: Manual browser verification**

Open `index.html`:
1. First run shows a "new team" form. Add name + 2 players; add opponent name + 2 players.
2. Tap a tip button → game screen shows (placeholder for now) and `localStorage.hoops.game` exists; `hoops.teams` has your team.
3. Reload → resume banner appears with team names + period/clock. Tap Resume → stays in game. Reload → tap Discard → confirm → back to fresh Setup, `hoops.game` removed.
4. Reload → saved team is now selectable in the dropdown.

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css
git commit -m "feat: setup screen with roster editing, tip-off start, resume banner"
```

---

## Task 12: Game screen (render + interactions + clock ticking)

**Files:**
- Modify: `app.js` (`renderGame` + handlers + clock interval), `styles.css`

**Interfaces:**
- Consumes: `recordStat`, `adjustScore`, `togglePossession`, `recordTimeout`, `toggleClock`, `setClock`, `parseClock`, `endHalf`, `addOvertime`, `endGame`, `undo`, `clockRemaining`, `fmtClock`, `periodLabel`, `bonusState`, `STAT_TYPES`, `saveGame`, `render`.
- Produces: `renderGame()`, `commit(fn)` helper (applies a logic fn, saves, re-renders), clock interval management (`startTick`/`stopTick`), long-press wiring, `MODIFIERS` constant.

- [ ] **Step 1: Implement `commit`, tick loop, and `MODIFIERS`**

```js
const MODIFIERS = {
  '2pt': ['Layup','Dunk','Mid-range'],
  '3pt': ['Long distance'],
  'foul': ['Shooting','Technical','On the ground'],
};

function commit(producer) {            // producer: (game, nowMs) => game
  state.game = producer(state.game, Date.now());
  saveGame();
  render();
}

let tickHandle = null;
function startTick() {
  stopTick();
  tickHandle = setInterval(() => {
    const g = state.game;
    if (!g || g.screen !== 'game') return stopTick();
    if (g.clock.running) {
      const rem = clockRemaining(g.clock, Date.now());
      document.getElementById('clock-display').textContent = fmtClock(rem);
      if (rem <= 0) commit((game, now) => stopClock(game, now));  // auto-stop at 0:00
    }
  }, 250);
}
function stopTick() { if (tickHandle) { clearInterval(tickHandle); tickHandle = null; } }
```

- [ ] **Step 2: Implement `renderGame`**

```js
function renderGame() {
  const g = state.game;
  const el = document.getElementById('game');
  const tf = g.teamFouls, bn = (team) => bonusState(tf[team]);
  const bonusBadge = (team) => bn(team)==='double' ? '<span class="badge dbl">DBL BONUS</span>'
    : bn(team)==='bonus' ? '<span class="badge bon">BONUS</span>' : '';

  // Physical left/right follows myTeamSide (display only)
  const myLeft = g.config.myTeamSide === 'home';
  const leftTeam = myLeft ? 'my' : 'opp';
  const rightTeam = myLeft ? 'opp' : 'my';

  el.innerHTML = `
    <header class="gh">
      <div class="score-box">
        <div class="tn">${esc(teamName(g,leftTeam))}</div>
        <div class="sc">${g.score[leftTeam]}</div>
        <div class="adj"><button data-adj="${leftTeam}:-1">−</button><button data-adj="${leftTeam}:1">＋</button></div>
      </div>
      <div class="clock">
        <div id="clock-display" class="cd">${fmtClock(clockRemaining(g.clock, Date.now()))}</div>
        <div class="period">${periodLabel(g.period, g.config.numHalves)}</div>
        <div class="cbtns"><button id="clk-toggle">${g.clock.running?'STOP':'START'}</button><button id="clk-set">SET</button></div>
      </div>
      <div class="score-box">
        <div class="tn">${esc(teamName(g,rightTeam))}</div>
        <div class="sc">${g.score[rightTeam]}</div>
        <div class="adj"><button data-adj="${rightTeam}:-1">−</button><button data-adj="${rightTeam}:1">＋</button></div>
      </div>
    </header>

    <div class="infobar">
      <span>Fouls ${esc(teamName(g,leftTeam))}: ${tf[leftTeam]} ${bonusBadge(leftTeam)}</span>
      <button id="poss">◀ ${esc(teamName(g, g.possession))} ▶</button>
      <span>Fouls ${esc(teamName(g,rightTeam))}: ${tf[rightTeam]} ${bonusBadge(rightTeam)}</span>
    </div>
    <div class="infobar small">
      <span>TO: ${g.timeouts[leftTeam]}</span><span>TO: ${g.timeouts[rightTeam]}</span>
    </div>

    <div class="court">
      <div class="col">${renderPlayers(g, leftTeam)}</div>
      <div class="controls">${renderControls(g)}</div>
      <div class="col">${renderPlayers(g, rightTeam)}</div>
    </div>

    <div class="recent">${g.log.slice(-10).reverse().map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`).join('')}</div>

    <footer class="gf">
      <button id="btn-timeout">Timeout</button>
      <button id="btn-undo">Undo</button>
      ${g.period < g.config.numHalves
        ? `<button id="btn-endhalf">END HALF</button>`
        : `<button id="btn-endgame">END GAME</button><button id="btn-ot">+OT</button>`}
    </footer>
  `;
  wireGame();
  startTick();
}

function teamName(g, team) { return team==='my' ? g.myTeam.name : g.oppTeam.name; }

function renderPlayers(g, team) {
  const t = team==='my' ? g.myTeam : g.oppTeam;
  return t.players.map((p) => `
    <button class="pl ${g.selectedPlayerId===p.id?'sel':''}" data-pl="${team}:${p.id}">
      <span class="num">#${p.num}</span>
      <span class="nm">${esc(p.name||'')}</span>
      <span class="pp">${p.pts} pts · ${p.pf} f</span>
    </button>`).join('');
}

function renderControls(g) {
  const sel = g.selectedPlayerId;
  const selTeam = selectedTeam(g);
  const oppSelected = selTeam === 'opp';
  const disAttr = (stat) => (oppSelected && !STAT_TYPES.OPP.includes(stat)) ? 'disabled' : '';
  return `
    <div class="makemiss">
      <button id="mm-make" class="${g.makeMode?'active':''}">MAKE</button>
      <button id="mm-miss" class="${!g.makeMode?'active':''}">MISS</button>
    </div>
    <div class="shots">
      <button data-stat="2pt">2PT</button>
      <button data-stat="3pt">3PT</button>
      <button data-stat="ft">FT</button>
    </div>
    <div class="stats">
      ${['stl','blk','ast','reb','to','foul'].map((s)=>`<button data-stat="${s}" ${disAttr(s)}>${s.toUpperCase()}</button>`).join('')}
    </div>
    <p class="sel-hint">${sel ? 'Selected: '+esc(selectedLabel(g)) : 'Tap a player'}</p>
  `;
}

function selectedTeam(g) {
  if (!g.selectedPlayerId) return null;
  if (g.myTeam.players.some((p)=>p.id===g.selectedPlayerId)) return 'my';
  if (g.oppTeam.players.some((p)=>p.id===g.selectedPlayerId)) return 'opp';
  return null;
}
function selectedLabel(g) {
  const team = selectedTeam(g); if (!team) return '';
  const t = team==='my'?g.myTeam:g.oppTeam;
  const p = t.players.find((x)=>x.id===g.selectedPlayerId);
  return p ? `#${p.num} ${p.name||''}` : '';
}
```

- [ ] **Step 3: Implement `wireGame` (selection, stats, long-press, clock, footer)**

```js
function wireGame() {
  const g = state.game;
  const $ = (id) => document.getElementById(id);

  el_each('[data-pl]', (b) => b.onclick = () => {
    const [, id] = b.dataset.pl.split(':');
    state.game.selectedPlayerId = (state.game.selectedPlayerId === id) ? null : id;
    saveGame(); render();
  });

  el_each('[data-adj]', (b) => b.onclick = () => {
    const [team, delta] = b.dataset.adj.split(':');
    commit((game, now) => adjustScore(game, team, parseInt(delta,10), now));
  });

  $('mm-make') && ($('mm-make').onclick = () => { state.game.makeMode = true; saveGame(); render(); });
  $('mm-miss') && ($('mm-miss').onclick = () => { state.game.makeMode = false; saveGame(); render(); });

  // Stat buttons: quick tap = no modifier; long-press = modifier menu (my team only)
  el_each('[data-stat]', (b) => {
    if (b.disabled) return;
    const stat = b.dataset.stat;
    attachPressHandlers(b, stat);
  });

  $('poss') && ($('poss').onclick = () => commit((game,now)=>togglePossession(game,now)));
  $('clk-toggle') && ($('clk-toggle').onclick = () => commit((game,now)=>toggleClock(game,now)));
  $('clk-set') && ($('clk-set').onclick = () => {
    const input = prompt('Set clock (M:SS)', fmtClock(clockRemaining(g.clock, Date.now())));
    const secs = parseClock(input || '');
    if (secs != null) commit((game,now)=>setClock(game, secs, now));
  });

  $('btn-timeout') && ($('btn-timeout').onclick = () => {
    const who = prompt(`Timeout for which team? Type "1" for ${g.myTeam.name} or "2" for ${g.oppTeam.name}`);
    if (who === '1') commit((game,now)=>recordTimeout(game,'my',now));
    else if (who === '2') commit((game,now)=>recordTimeout(game,'opp',now));
  });
  $('btn-undo') && ($('btn-undo').onclick = () => commit((game)=>undo(game)));
  $('btn-endhalf') && ($('btn-endhalf').onclick = () => commit((game,now)=>endHalf(game,now)));
  $('btn-endgame') && ($('btn-endgame').onclick = () => commit((game,now)=>endGame(game,now)));
  $('btn-ot') && ($('btn-ot').onclick = () => commit((game,now)=>addOvertime(game,now)));
}

function recordSelectedStat(stat, modifier) {
  const g = state.game;
  const team = selectedTeam(g);
  if (!team) return;
  commit((game, now) => recordStat(game, { team, playerId: g.selectedPlayerId, stat, modifier }, now));
}

function attachPressHandlers(btn, stat) {
  let timer = null, longFired = false;
  const mods = MODIFIERS[stat];
  const start = () => {
    longFired = false;
    if (!mods || selectedTeam(state.game) !== 'my') return;  // modifiers: my team only
    timer = setTimeout(() => { longFired = true; openModifierMenu(stat); }, 500);
  };
  const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('touchstart', start, { passive:true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.onclick = () => { if (longFired) { longFired = false; return; } recordSelectedStat(stat, null); };
}

function openModifierMenu(stat) {
  const choice = prompt(`${stat.toUpperCase()} modifier — type one:\n${MODIFIERS[stat].join(', ')}\n(or leave blank for none)`);
  const valid = MODIFIERS[stat].find((m) => m.toLowerCase() === (choice||'').trim().toLowerCase());
  recordSelectedStat(stat, valid || null);
}
```

> Note: `prompt()` is used for the timeout picker, clock SET, and the long-press modifier menu to keep Task 12 self-contained and dependency-free. A later polish task may replace these with in-DOM popovers; behavior and logic calls are unchanged.

- [ ] **Step 4: Add game styles + visibility re-sync to `app.js`/`styles.css`**

In `app.js`, add inside `init()` after `render()`:
```js
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.game && state.game.screen === 'game') render();
  });
```

In `styles.css`:
```css
#game { display:flex; flex-direction:column; height:100vh; }
.gh { display:flex; justify-content:space-between; align-items:center; padding:8px; background:#111; color:#fff; }
.score-box { text-align:center; flex:1; } .score-box .sc { font-size:2rem; font-weight:700; }
.adj button { width:32px; height:32px; margin:0 2px; }
.clock { text-align:center; flex:1; } .cd { font-size:1.8rem; font-variant-numeric:tabular-nums; }
.cbtns button { padding:6px 10px; margin:2px; }
.infobar { display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:#1f2937; color:#fff; font-size:.8rem; }
.infobar.small { background:#374151; }
.badge { padding:1px 5px; border-radius:4px; font-weight:700; } .badge.bon{background:#facc15;color:#000;} .badge.dbl{background:#dc2626;}
.court { display:flex; flex:1; overflow:hidden; }
.col { width:34%; overflow-y:auto; padding:4px; } .controls { flex:1; padding:4px; }
.pl { display:flex; flex-direction:column; width:100%; padding:6px; margin-bottom:4px; border:2px solid #ccc; border-radius:8px; background:#fff; text-align:left; }
.pl.sel { border-color:#f59e0b; background:#fff7ed; }
.makemiss button, .shots button, .stats button { padding:12px; margin:2px; font-weight:700; }
.makemiss button.active { background:#16a34a; color:#fff; }
.shots { display:flex; } .shots button { flex:1; } .stats { display:grid; grid-template-columns:repeat(3,1fr); }
.stats button:disabled { opacity:.3; }
.recent { max-height:88px; overflow-y:auto; font-size:.75rem; padding:4px 8px; background:#f5f5f5; }
.gf { display:flex; gap:6px; padding:8px; } .gf button { flex:1; padding:14px; font-weight:700; }
```

- [ ] **Step 5: Manual browser verification**

Start a game, then verify:
1. Tap a my-team player → highlights; tap 2PT → score +2, player pts +2, event in recent log.
2. Toggle MISS → tap 3PT → attempt only, no score, MISS reverts to MAKE.
3. Select an opponent player → REB/STL/BLK/AST/TO disabled; 2PT/3PT/FT/FOUL work.
4. FOUL 7× on one team → BONUS badge; 10× → DBL BONUS.
5. START clock → display counts down; lock the phone ~10s → unlock → time caught up. STOP, SET to 1:00.
6. Possession toggles; Timeout picker stops the clock and increments TO.
7. Undo reverses the last action. END HALF → H2, clock reset, fouls cleared. In H2, +OT and END GAME appear; END GAME → summary screen.
8. With "My team is Away" chosen at setup, your team renders on the right but still shows the detailed stat buttons when selected.

- [ ] **Step 6: Commit**

```bash
git add app.js styles.css
git commit -m "feat: game screen — scoring, stats, clock, fouls, possession, periods, undo"
```

---

## Task 13: Summary screen + print + share

**Files:**
- Modify: `app.js` (`renderSummary` + handlers), `styles.css` (incl. `@media print`)

**Interfaces:**
- Consumes: `periodLabel`, `fmtShot`, `saveGame`, `render`, `teamName`, `esc`.
- Produces: `renderSummary()`, `newGameFromSummary()`, box-score table builders, period-breakdown table.

- [ ] **Step 1: Implement `renderSummary` in `app.js`**

```js
function renderSummary() {
  stopTick();
  const g = state.game;
  const myLeft = g.config.myTeamSide === 'home';
  const leftTeam = myLeft ? 'my' : 'opp';
  const rightTeam = myLeft ? 'opp' : 'my';
  const deltas = g.periodScores.map((ps, i) => ({
    my: i===0 ? ps.my : ps.my - g.periodScores[i-1].my,
    opp: i===0 ? ps.opp : ps.opp - g.periodScores[i-1].opp,
  }));

  document.getElementById('summary').innerHTML = `
    <div class="sum-actions no-print">
      <button id="sum-print">Print / Save PDF</button>
      <button id="sum-share" ${typeof navigator.share==='function'?'':'hidden'}>Share</button>
      <button id="sum-new">New Game</button>
    </div>
    <h1>Final</h1>
    <div class="final">
      <span>${esc(teamName(g,leftTeam))} ${g.score[leftTeam]}</span> –
      <span>${g.score[rightTeam]} ${esc(teamName(g,rightTeam))}</span>
    </div>

    <h2>Scoring by period</h2>
    <table class="bs"><thead><tr><th>Team</th>
      ${deltas.map((_,i)=>`<th>${periodLabel(i+1,g.config.numHalves)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>
        <tr><td>${esc(teamName(g,leftTeam))}</td>${deltas.map((d)=>`<td>${d[leftTeam]}</td>`).join('')}<td>${g.score[leftTeam]}</td></tr>
        <tr><td>${esc(teamName(g,rightTeam))}</td>${deltas.map((d)=>`<td>${d[rightTeam]}</td>`).join('')}<td>${g.score[rightTeam]}</td></tr>
      </tbody></table>

    ${myBoxScore(g)}
    ${oppBoxScore(g)}

    <h2>Game log</h2>
    <div class="log">${g.log.map((e)=>`<div>${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`).join('')}</div>
  `;
  document.getElementById('sum-print').onclick = () => window.print();
  const share = document.getElementById('sum-share');
  if (share && !share.hidden) share.onclick = () => navigator.share({
    title: `${g.myTeam.name} vs ${g.oppTeam.name}`,
    text: `${g.myTeam.name} ${g.score.my} – ${g.score.opp} ${g.oppTeam.name}`,
  }).catch(()=>{});
  document.getElementById('sum-new').onclick = newGameFromSummary;
}

function myBoxScore(g) {
  const cols = ['PTS','FG','3PT','FT','REB','STL','BLK','AST','TO','FLS'];
  const rows = g.myTeam.players.slice().sort((a,b)=>a.num-b.num).map((p)=>`
    <tr><td>#${p.num} ${esc(p.name||'')}</td>
      <td>${p.pts}</td><td>${fmtShot(p.fgm+p.tpm,p.fga+p.tpa)}</td><td>${fmtShot(p.tpm,p.tpa)}</td>
      <td>${fmtShot(p.ftm,p.fta)}</td><td>${p.reb}</td><td>${p.stl}</td><td>${p.blk}</td>
      <td>${p.ast}</td><td>${p.to}</td><td>${p.pf}</td></tr>`).join('');
  return `<h2>${esc(g.myTeam.name)}</h2><table class="bs"><thead><tr><th>Player</th>${cols.map((c)=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

function oppBoxScore(g) {
  const rows = g.oppTeam.players.slice().sort((a,b)=>a.num-b.num).map((p)=>`
    <tr><td>#${p.num} ${esc(p.name||'')}</td><td>${p.pts}</td><td>${p.pf}</td></tr>`).join('');
  return `<h2>${esc(g.oppTeam.name)}</h2><table class="bs"><thead><tr><th>Player</th><th>PTS</th><th>FLS</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function newGameFromSummary() {
  state.game = null;
  saveGame();
  setupDraft = defaultDraft();
  render();
}
```

- [ ] **Step 2: Add `#summary` element to `index.html`**

Confirm `index.html` already has `<section id="summary" hidden></section>` (from Task 1). No change needed unless missing.

- [ ] **Step 3: Add summary + print styles to `styles.css`**

```css
#summary { padding:16px; max-width:760px; margin:0 auto; color:#111; background:#fff; }
.final { font-size:1.5rem; font-weight:700; text-align:center; margin:8px 0 16px; }
.sum-actions { display:flex; gap:8px; margin-bottom:12px; }
.sum-actions button { flex:1; padding:12px; font-weight:700; }
table.bs { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:.85rem; }
table.bs th, table.bs td { border:1px solid #ddd; padding:4px 6px; text-align:center; }
table.bs td:first-child, table.bs th:first-child { text-align:left; }
.log { font-size:.8rem; } .log div { padding:2px 0; border-bottom:1px solid #f0f0f0; }
@media print {
  .no-print { display:none !important; }
  #setup, #game { display:none !important; }
  #summary { max-width:none; padding:0; }
  table.bs { font-size:10pt; }
}
```

- [ ] **Step 4: Manual browser verification**

1. Play a short game, END GAME → summary shows final score, period table, my-team full box score, opponent PTS/FLS box score, full log.
2. With "My team is Away," verify left/right placement matches but my box score still has full columns.
3. Click Print → browser print preview shows only the summary (no buttons/other screens).
4. New Game → returns to fresh Setup; `hoops.game` removed; saved team still present.

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css index.html
git commit -m "feat: post-game summary, box scores, print stylesheet, share"
```

---

## Task 14: Final pass — README checklist + full test run + deploy notes

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a manual QA checklist and confirmed green test suite.

- [ ] **Step 1: Run the full logic test suite**

Run: `node --test`
Expected: PASS — all logic tests green.

- [ ] **Step 2: Expand `README.md` with a manual QA checklist**

```md
## Manual QA checklist
- [ ] First run: create a team, add opponent, tap tip → game starts, clock runs.
- [ ] Scoring (2/3/FT make+miss), make/miss auto-reset, detailed stats for my team.
- [ ] Opponent limited to points + fouls.
- [ ] Team fouls bonus (7) / double bonus (10) badges.
- [ ] Clock: start/stop, SET, lock-screen catch-up, auto-stop at 0:00, timeout stops clock.
- [ ] Possession toggle; undo; END HALF; +OT; END GAME.
- [ ] "My team is Away": my team renders right, still gets detailed controls + saved correctly.
- [ ] Summary: final score, period table, box scores, log; Print shows only summary; New Game resets.
- [ ] Reload mid-game → resume banner → Resume restores exact state; Discard clears it.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: manual QA checklist and deploy notes"
```

- [ ] **Step 4: (Optional) Tag a release**

```bash
git tag v1.0.0
```

---

## Notes for the implementer

- **Never let shell code run at module load.** Only `init` (called on `DOMContentLoaded`) touches the DOM. This keeps `node --test` working.
- **`commit(producer)` is the one mutation path on the game screen.** Every button handler that changes game state goes through it so save + re-render are never forgotten.
- **`prompt()`/`confirm()`** are intentional MVP shortcuts for the timeout picker, clock SET, modifier menu, and discard confirmation. They keep the build dependency-free; swapping them for in-DOM popovers later won't touch the pure logic.
- **`Date.now()` lives only in the shell** (`commit`, `startTick`, `renderGame`). Pure logic always receives `nowMs` as an argument, which is why it stays testable.
