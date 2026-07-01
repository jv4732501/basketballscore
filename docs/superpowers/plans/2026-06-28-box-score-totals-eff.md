# Box Score: Team Totals + EFF Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-player EFF (efficiency) column and a team TOTAL row to each box-score table in the post-game summary.

**Architecture:** Incremental change to the existing single-file scorer. `playerEff` is a pure function, TDD'd with `node --test`; the EFF column and TOTAL row in `boxScore` are shell, verified by a Node load-check + manual browser QA.

**Tech Stack:** Vanilla JS (ES2020+), HTML, CSS. Node's built-in `node --test`.

## Global Constraints

- **No runtime dependencies, no build step, no network.** App is `index.html` + `styles.css` + `app.js`.
- **`app.js` must stay `require()`-able in Node with no DOM.** Verify with `node -e "require('./app.js'); console.log('loads OK')"`.
- **Pure-logic functions are deterministic and side-effect-free;** never mutate inputs.
- **EFF formula (verbatim):** `pts + (oreb+dreb) + ast + stl + blk − ((fga+tpa)−(fgm+tpm)) − (fta−ftm) − to`, where `to` is the per-player **turnover** stat (not timeouts). EFF may be negative.
- **`boxScore` is the shared renderer** — both teams get the column and TOTAL row.
- **Test runner:** `node --test`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: `playerEff` pure function

**Files:**
- Modify: `app.js` (add `playerEff`; extend export shim)
- Test: `logic.test.js`

**Interfaces:**
- Consumes: a player stat object (`pts, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, stl, blk, ast, to`).
- Produces: `playerEff(p) → number` per the EFF formula; may be negative.

- [ ] **Step 1: Write the failing tests**

Add to `logic.test.js`:
```js
const { playerEff } = app;

test('playerEff computes efficiency from a mixed stat line', () => {
  // reb=5; missFG=(9+3)-(4+1)=7; missFT=4-2=2; eff = 10+5+2+1+1 -7 -2 -5 = 5
  const p = { pts:10, fgm:4, fga:9, tpm:1, tpa:3, ftm:2, fta:4, oreb:2, dreb:3, stl:1, blk:1, ast:2, to:5 };
  assert.strictEqual(playerEff(p), 5);
});

test('playerEff can be negative', () => {
  // missFG=5, missFT=2, to=3 → 0 - 5 - 2 - 3 = -10
  const p = { pts:0, fgm:0, fga:5, tpm:0, tpa:0, ftm:0, fta:2, oreb:0, dreb:0, stl:0, blk:0, ast:0, to:3 };
  assert.strictEqual(playerEff(p), -10);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `playerEff is not a function`.

- [ ] **Step 3: Implement**

In `app.js`, add (near `fmtMinutes`/`teamDisplayName`):
```js
function playerEff(p) {
  const missFG = (p.fga + p.tpa) - (p.fgm + p.tpm);
  const missFT = p.fta - p.ftm;
  return p.pts + (p.oreb + p.dreb) + p.ast + p.stl + p.blk - missFG - missFT - p.to;
}
```

Add `playerEff` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (suite green; the two new tests pass).

- [ ] **Step 5: Commit**

```bash
git add app.js logic.test.js
git commit -m "feat: playerEff efficiency pure function"
```

---

## Task 2: EFF column + TOTAL row in `boxScore` (shell)

**Files:**
- Modify: `app.js` (`boxScore`), `styles.css`

**Interfaces:**
- Consumes: `playerEff` (Task 1), `fmtShot`, `fmtMinutes`, `esc`.
- Produces: each box-score table has a trailing `EFF` column and a bottom `TOTAL` row summing all columns.

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Rewrite `boxScore` with the EFF column and TOTAL row**

Replace `boxScore` in `app.js` with:
```js
function boxScore(team) {
  const cols = ['PTS','FG','3PT','FT','OREB','DREB','REB','STL','BLK','AST','TO','FLS','MIN','EFF'];
  const players = team.players.slice().sort((a,b)=>a.num-b.num);
  const rows = players.map((p)=>`
    <tr><td>#${p.num} ${esc(p.name||'')}</td>
      <td>${p.pts}</td><td>${fmtShot(p.fgm+p.tpm,p.fga+p.tpa)}</td><td>${fmtShot(p.tpm,p.tpa)}</td>
      <td>${fmtShot(p.ftm,p.fta)}</td><td>${p.oreb}</td><td>${p.dreb}</td><td>${p.oreb+p.dreb}</td>
      <td>${p.stl}</td><td>${p.blk}</td>
      <td>${p.ast}</td><td>${p.to}</td><td>${p.pf}</td><td>${fmtMinutes(p.courtSecs)}</td><td>${playerEff(p)}</td></tr>`).join('');
  const sum = (f) => players.reduce((n,p)=>n+f(p), 0);
  const t = {
    pts:sum(p=>p.pts), fgm:sum(p=>p.fgm), fga:sum(p=>p.fga), tpm:sum(p=>p.tpm), tpa:sum(p=>p.tpa),
    ftm:sum(p=>p.ftm), fta:sum(p=>p.fta), oreb:sum(p=>p.oreb), dreb:sum(p=>p.dreb),
    stl:sum(p=>p.stl), blk:sum(p=>p.blk), ast:sum(p=>p.ast), to:sum(p=>p.to), pf:sum(p=>p.pf),
    courtSecs:sum(p=>p.courtSecs||0), eff:sum(p=>playerEff(p)),
  };
  const total = `
    <tr class="totrow"><td>TOTAL</td>
      <td>${t.pts}</td><td>${fmtShot(t.fgm+t.tpm,t.fga+t.tpa)}</td><td>${fmtShot(t.tpm,t.tpa)}</td>
      <td>${fmtShot(t.ftm,t.fta)}</td><td>${t.oreb}</td><td>${t.dreb}</td><td>${t.oreb+t.dreb}</td>
      <td>${t.stl}</td><td>${t.blk}</td>
      <td>${t.ast}</td><td>${t.to}</td><td>${t.pf}</td><td>${fmtMinutes(t.courtSecs)}</td><td>${t.eff}</td></tr>`;
  return `<h2>${esc(team.name)}</h2><table class="bs"><thead><tr><th>Player</th>${cols.map((c)=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}${total}</tbody></table>`;
}
```
(Header is `Player` + 14 stat columns = 15 cells; each player row and the TOTAL row each have 15 cells.)

- [ ] **Step 2: Add the TOTAL-row style**

In `styles.css`, add (near the `table.bs` rules):
```css
table.bs .totrow td { font-weight:700; border-top:2px solid var(--border); }
```

- [ ] **Step 3: Verify Node load + commit**

Run: `node --test` (still green — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js styles.css
git commit -m "feat: box-score EFF column + team TOTAL row"
```

Manual browser check (deferred): END GAME → each team's box score shows an EFF column (matching the formula, negative allowed) and a bold TOTAL row that sums every column, including FG/3PT/FT made-attempts, MIN, and team EFF; header and rows stay aligned; the summary still prints cleanly.

---

## Notes for the implementer

- **Only Task 1 is TDD'd** (the pure function). Task 2 is shell — verify with the load-check + manual steps.
- **`courtSecs||0`** in the totals sum guards pre-cycle players that lack the field (same defensive pattern as `fmtMinutes`).
- **No game-logic change** — `boxScore` is a pure string renderer; the suite stays green.
