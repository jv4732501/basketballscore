# Live-Game Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both teams record the full stat set (drop the opponent's points+fouls-only restriction), add manual ± team-foul adjustment, and move the recent-events log + UNDO into the center column.

**Architecture:** Incremental change to the existing single-file scorer (`app.js` pure-logic + shell, `styles.css`, `logic.test.js`). Pure-logic changes are TDD'd with `node --test`; shell changes are verified by a Node load-check plus manual browser QA. Tasks are grouped by feature so each leaves the app in a working state.

**Tech Stack:** Vanilla JS (ES2020+), HTML, CSS. Node's built-in `node --test` (no `npm install`).

## Global Constraints

- **No runtime dependencies, no build step, no network.** App is `index.html` + `styles.css` + `app.js`.
- **`app.js` must stay `require()`-able in Node with no DOM** — no top-level `document`/`window`/`localStorage`; only the `DOMContentLoaded` bootstrap under `if (typeof document !== 'undefined')`. Verify after every task with `node -e "require('./app.js'); console.log('loads OK')"`.
- **Pure-logic functions are deterministic and side-effect-free:** all inputs as arguments (including `nowMs`), no `Date.now()` in logic, `structuredClone` via `clone()`, never mutate inputs.
- **Per-team state is keyed by identity (`my`/`opp`).** `config.myTeamSide` is display-only. Both teams now record the **same full stat set**; the only non-symmetric thing is that the roster saved to `hoops.teams` is always `myTeam`.
- **Test runner:** `node --test` with `node:assert`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Defaults unchanged:** bonus at 7 team fouls, double bonus at 10; long-press 500ms.

---

## File Structure

All changes are to existing files:
- `app.js` — `newGame`, `recordStat`, `STAT_TYPES`, remove `emptyOppStats`; new `adjustTeamFouls`; `undo` (+`teamfoul` kind); shell: `renderControls`, `renderGame`, `wireGame`, `attachPressHandlers`, `myBoxScore`/`oppBoxScore`.
- `styles.css` — center-column log, team-foul ± buttons.
- `logic.test.js` — update opponent/identity tests; add `adjustTeamFouls` tests.

---

## Task 1: Symmetric teams — both teams record the full stat set

**Files:**
- Modify: `app.js` (`emptyOppStats` removal, `newGame`, `STAT_TYPES`, `recordStat`, export shim, and the two coupled shell spots in `renderControls`/`attachPressHandlers`)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `pushLog`, `emptyMyStats`, `SHOT_INFO`, `PLAIN_LABEL`, `findPlayer`, `playerTag`.
- Produces: `STAT_TYPES` is now a flat array `['2pt','3pt','ft','reb','stl','blk','ast','to','foul']`; `recordStat(game, {team, playerId, stat, modifier}, nowMs)` accepts any of those stats for **either** team; `newGame` builds opponent players with the full `emptyMyStats()` shape; `emptyOppStats` no longer exists.

This is a behavior **change**, so TDD here means: update the tests to the new expected behavior first, watch them fail against the current code, then change the implementation.

- [ ] **Step 1: Update the tests to the new behavior**

In `logic.test.js`, line ~11, remove `emptyOppStats` from the destructure:
```js
  clone, emptyMyStats, periodLabel, bonusState,
```

Remove the now-obsolete assertion in the "empty stat shapes" test (delete this line, ~26):
```js
  assert.deepStrictEqual(emptyOppStats(), { pts:0, pf:0 });
```

In the "newGame builds initial state keyed by identity" test, change the opponent-shape assertions (~71–72) to:
```js
  assert.strictEqual(g.oppTeam.players[0].pts, 0);   // both teams carry the full stat set
  assert.strictEqual('reb' in g.oppTeam.players[0], true);
```

Replace the whole "opponent can only score and foul" test (~158–166) with:
```js
test('opponent records the full stat set too', () => {
  let g = freshGame();
  g = recordStat(g, { team:'opp', playerId:'o1', stat:'3pt' }, 1000);
  assert.strictEqual(g.oppTeam.players[0].pts, 3);
  assert.strictEqual(g.score.opp, 3);
  g = recordStat(g, { team:'opp', playerId:'o1', stat:'blk' }, 2000);  // now allowed
  assert.strictEqual(g.oppTeam.players[0].blk, 1);
});
```

Replace the "opponent shots are always makes regardless of makeMode" test (~168–173) with:
```js
test('opponent shots respect makeMode (miss when in MISS mode)', () => {
  let g = freshGame();
  g.makeMode = false;
  g = recordStat(g, { team:'opp', playerId:'o1', stat:'2pt' }, 1000);
  assert.strictEqual(g.score.opp, 0);                // miss → no points
  assert.strictEqual(g.oppTeam.players[0].fga, 1);   // attempt still recorded
  assert.strictEqual(g.makeMode, true);              // auto-reset to MAKE after a miss
});
```

In the Task-8 identity block, replace the `opponent limited to pts+fouls when myTeamSide=${side}` test (~278–283) with:
```js
  test(`both teams record the full stat set when myTeamSide=${side}`, () => {
    let g = gameWithSide(side);
    g = recordStat(g, { team:'opp', playerId:'o1', stat:'blk' }, 1000);
    assert.strictEqual(g.oppTeam.players[0].blk, 1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — the new opponent tests fail because the current code rejects `blk` for the opponent and forces opponent shots to be makes; the `newGame` test fails on `'reb' in opp == true`.

- [ ] **Step 3: Change the implementation**

In `app.js`, delete the `emptyOppStats` function (line ~10):
```js
function emptyOppStats() { return { pts:0, pf:0 }; }
```

In `newGame`, change the opponent players map (line ~46) from `...emptyOppStats()` to `...emptyMyStats()`:
```js
      players: oppTeam.players.map((p) => ({ id:p.id, num:p.num, name:p.name, ...emptyMyStats() })),
```

Replace the `STAT_TYPES` object (lines ~116–119) with a flat array:
```js
const STAT_TYPES = ['2pt','3pt','ft','reb','stl','blk','ast','to','foul'];
```

In `recordStat`, replace the allowed-stat guard (lines ~136–137):
```js
  if (!STAT_TYPES.includes(stat)) return game;
```
Change the shot make/miss line (~150) to drop the opponent special-case:
```js
    const made = g.makeMode;
```
Change the miss branch makeMode reset (~161) to apply to either team:
```js
      rev.makeModeWas = g.makeMode; g.makeMode = true;
```

In the export shim (line ~311), remove `emptyOppStats`:
```js
    VERSION, clone, emptyMyStats, periodLabel, bonusState,
```

Now the two coupled shell spots that referenced the old per-team restriction (so the browser stays correct):

In `renderControls` (~731–751), remove the `oppSelected`/`disAttr` disabling so no stat button is ever disabled. Replace the function body's `selTeam`/`oppSelected`/`disAttr` lines and the `.stats` button map:
```js
function renderControls(g) {
  const sel = g.selectedPlayerId;
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
      ${['stl','blk','ast','reb','to','foul'].map((s)=>`<button data-stat="${s}">${s.toUpperCase()}</button>`).join('')}
    </div>
    <p class="sel-hint">${sel ? 'Selected: '+esc(selectedLabel(g)) : 'Tap a player'}</p>
  `;
}
```

In `attachPressHandlers` (~820–824), drop the `my team only` modifier guard so modifiers work for either team. The `start` function becomes:
```js
  const start = () => {
    longFired = false;
    if (!mods) return;                 // only buttons with modifiers arm the long-press
    timer = setTimeout(() => { longFired = true; openModifierMenu(stat); }, 500);
  };
```

(`wireGame`'s `if (b.disabled) return;` guard at ~786 is now harmless — no button is disabled — leave it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (all tests green; opponent now records full stats and respects makeMode).

- [ ] **Step 5: Verify Node load + commit**

Run: `node -e "require('./app.js'); console.log('loads OK')"`
Expected: `loads OK` (no error — confirms the shell edits didn't break require-ability).

```bash
git add app.js logic.test.js
git commit -m "feat: symmetric teams — both record the full stat set"
```

Manual browser check (deferred to QA): select an opponent player → STL/BLK/AST/REB/TO/FOUL all enabled and record; long-press 2PT on an opponent player opens the modifier menu.

---

## Task 2: Manual team-foul adjustment

**Files:**
- Modify: `app.js` (`adjustTeamFouls`, `undo`, export, `renderGame` info bar, `wireGame`), `styles.css`
- Test: `logic.test.js`

**Interfaces:**
- Consumes: `clone`, `pushLog`, `teamDisplayName`, `commit`, `el_each`, `bonusState`.
- Produces: `adjustTeamFouls(game, team, delta, nowMs) → game` — clamps `teamFouls[team]` at ≥0, logs a `team_foul_adj` entry, and carries `rev:{kind:'teamfoul', team, delta}` (applied delta after clamping). `undo` gains a `teamfoul` branch: `teamFouls[rev.team] -= rev.delta`.

- [ ] **Step 1: Write the failing tests**

Add to `logic.test.js` (after the score-adjust tests is fine):
```js
const { adjustTeamFouls } = app;

test('adjustTeamFouls changes count, clamps at zero, logs applied delta', () => {
  let g = freshGame();
  g = adjustTeamFouls(g, 'my', 3, 1000);
  assert.strictEqual(g.teamFouls.my, 3);
  g = adjustTeamFouls(g, 'my', -5, 2000);
  assert.strictEqual(g.teamFouls.my, 0);
  const last = g.log[g.log.length - 1];
  assert.strictEqual(last.type, 'team_foul_adj');
  assert.strictEqual(last.rev.kind, 'teamfoul');
  assert.strictEqual(last.rev.delta, -3);   // only -3 actually applied
});

test('undo reverses a manual team-foul adjustment', () => {
  let g = freshGame();
  g = adjustTeamFouls(g, 'opp', 2, 1000);
  assert.strictEqual(g.teamFouls.opp, 2);
  g = undo(g);
  assert.strictEqual(g.teamFouls.opp, 0);
  assert.strictEqual(g.log.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `adjustTeamFouls is not a function`.

- [ ] **Step 3: Implement the logic**

In `app.js`, add `adjustTeamFouls` next to `adjustScore` (after `adjustScore`, ~194):
```js
function adjustTeamFouls(game, team, delta, nowMs) {
  let g = clone(game);
  const next = Math.max(0, g.teamFouls[team] + delta);
  const applied = next - g.teamFouls[team];
  g.teamFouls[team] = next;
  const sign = applied >= 0 ? '+' + applied : String(applied);
  g = pushLog(g, {
    team, type: 'team_foul_adj',
    detail: `${teamDisplayName(g, team)} team fouls ${sign}`,
    rev: { kind: 'teamfoul', team, delta: applied },
  }, nowMs);
  return g;
}
```

In `undo`, add a branch after the `timeout` branch (~289, before the closing `}`):
```js
  } else if (rev.kind === 'teamfoul') {
    g.teamFouls[rev.team] -= rev.delta;
  }
```

Add `adjustTeamFouls` to the export shim (next to `adjustScore`, ~315):
```js
    adjustScore, adjustTeamFouls, togglePossession, setPossession, recordTimeout,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Wire the info-bar ± buttons (shell)**

In `renderGame`, replace the team-fouls info bar (lines ~690–694) so each side's count gets −/+ controls:
```html
    <div class="infobar">
      <span class="tf">Fouls ${esc(teamName(g,leftTeam))}: ${tf[leftTeam]} ${bonusBadge(leftTeam)}
        <button class="tfadj" data-tf="${leftTeam}:-1">−</button><button class="tfadj" data-tf="${leftTeam}:1">+</button></span>
      <button id="poss">◀ ${esc(teamName(g, g.possession))} ▶</button>
      <span class="tf">Fouls ${esc(teamName(g,rightTeam))}: ${tf[rightTeam]} ${bonusBadge(rightTeam)}
        <button class="tfadj" data-tf="${rightTeam}:-1">−</button><button class="tfadj" data-tf="${rightTeam}:1">+</button></span>
    </div>
```

In `wireGame`, add a handler next to the `[data-adj]` handler (~779):
```js
  el_each('[data-tf]', (b) => b.onclick = () => {
    const [team, delta] = b.dataset.tf.split(':');
    commit((game, now) => adjustTeamFouls(game, team, parseInt(delta,10), now));
  });
```

In `styles.css`, add (near the `.infobar` rules):
```css
.infobar .tf { display:inline-flex; align-items:center; gap:4px; }
.tfadj { width:22px; height:22px; padding:0; line-height:1; border-radius:4px; border:1px solid var(--border); background:var(--btn-bg); color:#fff; }
```

- [ ] **Step 6: Verify Node load + commit**

Run: `node --test` (still green) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js logic.test.js styles.css
git commit -m "feat: manual team-foul +/- adjustment (logged and undoable)"
```

Manual browser check (deferred): −/+ next to each team's foul count adjusts it, BONUS badge appears at 7 / DOUBLE at 10, UNDO reverses an adjustment.

---

## Task 3: Move the recent-events log + UNDO into the center column

**Files:**
- Modify: `app.js` (`renderControls`, `renderGame`), `styles.css`

**Interfaces:**
- Consumes: `g.log`, `periodLabel`, `esc`, `wireGame`'s existing `#btn-undo` handler.
- Produces: the recent-events list and the UNDO button render inside the center controls column; the full-width `.recent` strip and the footer Undo button are removed.

This is shell-only (no unit tests). Verified by load-check + manual QA.

- [ ] **Step 1: Render the log + UNDO inside the controls**

In `renderControls` (from Task 1), append a recent-events block and an UNDO button after the `sel-hint` paragraph. The function's returned template becomes:
```js
function renderControls(g) {
  const sel = g.selectedPlayerId;
  const recent = g.log.slice(-10).reverse()
    .map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`)
    .join('');
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
      ${['stl','blk','ast','reb','to','foul'].map((s)=>`<button data-stat="${s}">${s.toUpperCase()}</button>`).join('')}
    </div>
    <p class="sel-hint">${sel ? 'Selected: '+esc(selectedLabel(g)) : 'Tap a player'}</p>
    <button id="btn-undo" class="undo">UNDO</button>
    <div class="recent">${recent}</div>
  `;
}
```

- [ ] **Step 2: Remove the full-width strip and the footer Undo**

In `renderGame`, delete the full-width recent strip line (~705):
```js
    <div class="recent">${g.log.slice(-10).reverse().map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`).join('')}</div>
```

In the same `renderGame` footer (~707–713), remove the `<button id="btn-undo">Undo</button>` line so the footer is just Timeout + period controls:
```js
    <footer class="gf">
      <button id="btn-timeout">Timeout</button>
      ${g.period < g.config.numHalves
        ? `<button id="btn-endhalf">END HALF</button>`
        : `<button id="btn-endgame">END GAME</button><button id="btn-ot">+OT</button>`}
    </footer>
```

(`wireGame`'s `$('btn-undo') && (...)` handler is unchanged — `#btn-undo` now lives in the controls column, and the guard still finds it.)

- [ ] **Step 3: Adjust the CSS for the center-column log**

In `styles.css`, the existing `.recent` rule (~40) is `max-height:88px; ...; background:var(--surface-2); ...`. Update it so it fits inside the scrolling controls column, and add an UNDO style:
```css
.controls { flex:1; padding:4px; overflow-y:auto; }
.recent { max-height:140px; overflow-y:auto; font-size:.75rem; padding:4px 8px; background:var(--surface-2); color:var(--text); border-radius:6px; margin-top:6px; }
.undo { width:100%; margin-top:6px; padding:10px; font-weight:700; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```
(There is an existing `.controls { flex:1; padding:4px; }` rule — replace it with the line above that adds `overflow-y:auto`.)

- [ ] **Step 4: Verify Node load**

Run: `node --test` (still green — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css
git commit -m "feat: move recent-events log and UNDO into the center column"
```

Manual browser check (deferred): center column shows last ~10 events under the stat buttons; UNDO sits in the center and works; no bottom strip; footer has Timeout + END HALF/GAME/OT only; center column scrolls if it overflows.

---

## Task 4: Unify the post-game box score (opponent gets full columns)

**Files:**
- Modify: `app.js` (`myBoxScore`, `oppBoxScore`, and their call site in `renderSummary`)

**Interfaces:**
- Consumes: `esc`, `fmtShot`, `g.myTeam`, `g.oppTeam`.
- Produces: one `boxScore(team)` renderer used for both teams, replacing the separate `myBoxScore`/`oppBoxScore`. Both teams show the full columns (PTS, FG, 3PT, FT, REB, STL, BLK, AST, TO, FLS).

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Replace the two box-score functions with one**

In `app.js`, replace `myBoxScore` and `oppBoxScore` (lines ~609–623) with a single function that takes a team object:
```js
function boxScore(team) {
  const cols = ['PTS','FG','3PT','FT','REB','STL','BLK','AST','TO','FLS'];
  const rows = team.players.slice().sort((a,b)=>a.num-b.num).map((p)=>`
    <tr><td>#${p.num} ${esc(p.name||'')}</td>
      <td>${p.pts}</td><td>${fmtShot(p.fgm+p.tpm,p.fga+p.tpa)}</td><td>${fmtShot(p.tpm,p.tpa)}</td>
      <td>${fmtShot(p.ftm,p.fta)}</td><td>${p.reb}</td><td>${p.stl}</td><td>${p.blk}</td>
      <td>${p.ast}</td><td>${p.to}</td><td>${p.pf}</td></tr>`).join('');
  return `<h2>${esc(team.name)}</h2><table class="bs"><thead><tr><th>Player</th>${cols.map((c)=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}
```

- [ ] **Step 2: Update the call site in `renderSummary`**

In `renderSummary`, `leftTeam`/`rightTeam` are already computed (`'my'`/`'opp'`
strings, lines ~567–568). Replace the two call lines (~594–595):
```js
    ${myBoxScore(g)}
    ${oppBoxScore(g)}
```
with calls through the shared renderer, ordered to match the score header
(left team first), passing the team object:
```js
    ${boxScore(leftTeam === 'my' ? g.myTeam : g.oppTeam)}
    ${boxScore(rightTeam === 'my' ? g.myTeam : g.oppTeam)}
```

- [ ] **Step 3: Verify Node load**

Run: `node --test` (still green) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: unified full box score for both teams in the summary"
```

Manual browser check (deferred): play a game recording opponent rebounds/steals/etc., END GAME → the opponent box score now shows all columns (REB/STL/BLK/AST/TO), not just PTS/FLS, and prints correctly.

---

## Notes for the implementer

- **Behavior-change TDD (Task 1):** because this changes existing behavior, update the tests to the new expectation first, watch them fail, then change the code — don't write brand-new tests alongside the old contradictory ones.
- **Keep `app.js` Node-loadable** after every task — run the `require` check. Shell edits are fine as long as no DOM access runs at module load.
- **`Date.now()` stays in the shell only** (`commit`, `startTick`, `renderGame`, the `clk-set`/timeout prompts). New logic (`adjustTeamFouls`) takes `nowMs` as an argument.
- **One mutation path on the game screen:** the new `[data-tf]` handler goes through `commit`, like every other game mutation.
