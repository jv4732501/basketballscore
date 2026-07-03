# Share Full Game-Summary Text File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Final summary screen's "Share" button shares an actual text file containing the full game summary (final score, period scoring, both box scores, game log), instead of a one-line text blurb that iOS turns into a near-empty file when "Save to Files" is chosen.

**Architecture:** A new pure function `buildSummaryText(g, leftTeam, rightTeam, deltas)` (plus a small internal helper `boxScoreText(team)`) builds the plain-text content from the same data `renderSummary()` already computes for the on-screen HTML. The Share button's click handler constructs a `File` from that text and shares it via `navigator.share({ files })`, falling back to `navigator.share({ text })` (now the full text, not the old one-liner) when file-sharing isn't supported.

**Tech Stack:** Vanilla JS (`app.js`), Node's built-in test runner (`logic.test.js`), no build step, no dependencies.

## Global Constraints

- No PDF generation — out of scope; the existing "Print" button already provides a PDF path via the OS's native print-to-PDF/share flow.
- `buildSummaryText`/`boxScoreText` must not use `esc()` (that's for HTML escaping only — plain text needs raw strings).
- The Share handler must feature-detect `navigator.canShare({ files })` before attempting file sharing, and fall back to text-only `navigator.share` (using the full summary text) when unsupported.

---

### Task 1: `buildSummaryText` pure function + tests

**Files:**
- Modify: `app.js` — add `boxScoreText(team)` and `buildSummaryText(g, leftTeam, rightTeam, deltas)` (near `boxScore()`, which starts at line 1155); add `buildSummaryText` to the `module.exports` list (currently `app.js:494-536`).
- Test: `logic.test.js`

**Interfaces:**
- Produces: `buildSummaryText(g, leftTeam, rightTeam, deltas) -> string` — `g` is a game object as built by `newGame()` (already exported), `leftTeam`/`rightTeam` are `'my'|'opp'`, `deltas` is an array of `{my, opp}` (per-period point deltas, same shape `renderSummary()` computes). Consumed by Task 2's Share handler.

- [ ] **Step 1: Write the failing test**

Add to `logic.test.js` (after the existing tests; `newGame`, `periodLabel`, `fmtShot`, `fmtMinutes`, `playerEff` are already destructured from `app` earlier in the file — add `buildSummaryText` to that destructuring, or add a new one):

```js
const { buildSummaryText } = app;

function summaryFixtureGame() {
  const g = newGame({
    config: { halfLengthMin: 18, numHalves: 2, otLengthMin: 4, myTeamSide: 'home' },
    myTeam: { id: 't1', name: 'Hawks', players: [{ id: 'p1', num: 5, name: 'Smith' }] },
    oppTeam: { name: 'Eagles', players: [{ id: 'o1', num: 9, name: 'Jones' }] },
  });
  Object.assign(g.myTeam.players[0], {
    pts: 10,
    fgm: 4,
    fga: 8,
    tpm: 1,
    tpa: 2,
    ftm: 1,
    fta: 2,
    oreb: 2,
    dreb: 3,
    stl: 1,
    blk: 0,
    ast: 2,
    to: 1,
    pf: 2,
    courtSecs: 600,
  });
  Object.assign(g.oppTeam.players[0], {
    pts: 8,
    fgm: 3,
    fga: 7,
    tpm: 0,
    tpa: 1,
    ftm: 2,
    fta: 2,
    oreb: 1,
    dreb: 4,
    stl: 0,
    blk: 1,
    ast: 1,
    to: 2,
    pf: 3,
    courtSecs: 540,
  });
  g.score = { my: 10, opp: 8 };
  g.periodScores = [{ my: 10, opp: 8 }];
  g.log = [{ clockText: '5:30', period: 1, detail: 'Smith made 2PT' }];
  return g;
}

test('buildSummaryText produces the full plain-text game summary', () => {
  const g = summaryFixtureGame();
  const deltas = g.periodScores.map((ps, i) => ({
    my: i === 0 ? ps.my : ps.my - g.periodScores[i - 1].my,
    opp: i === 0 ? ps.opp : ps.opp - g.periodScores[i - 1].opp,
  }));
  const text = buildSummaryText(g, 'my', 'opp', deltas);
  const expected = [
    'Hawks vs Eagles',
    '',
    'FINAL: Hawks 10 – 8 Eagles',
    '',
    'Scoring by period',
    'H1 Total',
    'Hawks: 10 10',
    'Eagles: 8 8',
    '',
    'Hawks box score',
    '#5 Smith: 10 PTS, 5/10 FG, 1/2 3PT, 1/2 FT, 2 OREB, 3 DREB, 5 REB, 1 STL, 0 BLK, 2 AST, 1 TO, 2 FLS, 10.0 MIN, 11 EFF',
    'TOTAL: 10 PTS, 5/10 FG, 1/2 3PT, 1/2 FT, 2 OREB, 3 DREB, 5 REB, 1 STL, 0 BLK, 2 AST, 1 TO, 2 FLS, 10.0 MIN, 11 EFF',
    '',
    'Eagles box score',
    '#9 Jones: 8 PTS, 3/8 FG, 0/1 3PT, 2/2 FT, 1 OREB, 4 DREB, 5 REB, 0 STL, 1 BLK, 1 AST, 2 TO, 3 FLS, 9.0 MIN, 8 EFF',
    'TOTAL: 8 PTS, 3/8 FG, 0/1 3PT, 2/2 FT, 1 OREB, 4 DREB, 5 REB, 0 STL, 1 BLK, 1 AST, 2 TO, 3 FLS, 9.0 MIN, 8 EFF',
    '',
    'Game log',
    '5:30 H1 – Smith made 2PT',
  ].join('\n');
  assert.strictEqual(text, expected);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="buildSummaryText produces the full plain-text game summary"`
Expected: FAIL — `buildSummaryText` is not a function (it doesn't exist in `app.js` yet, so destructuring `const { buildSummaryText } = app;` gives `undefined`).

- [ ] **Step 3: Implement `boxScoreText` and `buildSummaryText`**

In `app.js`, add these two functions near `boxScore()` (which starts at line 1155 — place the new functions either just before or just after it):

```js
function boxScoreText(team) {
  const players = team.players.slice().sort((a, b) => a.num - b.num);
  const playerLine = (label, p) =>
    `${label}: ${p.pts} PTS, ${fmtShot(p.fgm + p.tpm, p.fga + p.tpa)} FG, ${fmtShot(p.tpm, p.tpa)} 3PT, ${fmtShot(p.ftm, p.fta)} FT, ${p.oreb} OREB, ${p.dreb} DREB, ${p.oreb + p.dreb} REB, ${p.stl} STL, ${p.blk} BLK, ${p.ast} AST, ${p.to} TO, ${p.pf} FLS, ${fmtMinutes(p.courtSecs)} MIN, ${playerEff(p)} EFF`;
  const lines = [`${team.name} box score`];
  players.forEach((p) => {
    lines.push(playerLine(`#${p.num} ${p.name || ''}`.trim(), p));
  });
  const sum = (f) => players.reduce((n, p) => n + f(p), 0);
  const t = {
    pts: sum((p) => p.pts),
    fgm: sum((p) => p.fgm),
    fga: sum((p) => p.fga),
    tpm: sum((p) => p.tpm),
    tpa: sum((p) => p.tpa),
    ftm: sum((p) => p.ftm),
    fta: sum((p) => p.fta),
    oreb: sum((p) => p.oreb),
    dreb: sum((p) => p.dreb),
    stl: sum((p) => p.stl),
    blk: sum((p) => p.blk),
    ast: sum((p) => p.ast),
    to: sum((p) => p.to),
    pf: sum((p) => p.pf),
    courtSecs: sum((p) => p.courtSecs || 0),
  };
  lines.push(playerLine('TOTAL', t));
  return lines.join('\n');
}

function buildSummaryText(g, leftTeam, rightTeam, deltas) {
  const teamOf = (team) => (team === 'my' ? g.myTeam : g.oppTeam);
  const lines = [];
  lines.push(`${g.myTeam.name} vs ${g.oppTeam.name}`);
  lines.push('');
  lines.push(
    `FINAL: ${teamName(g, leftTeam)} ${g.score[leftTeam]} – ${g.score[rightTeam]} ${teamName(g, rightTeam)}`,
  );
  lines.push('');
  lines.push('Scoring by period');
  const periodHeader = deltas.map((_, i) => periodLabel(i + 1, g.config.numHalves)).join(' ');
  lines.push(`${periodHeader} Total`);
  lines.push(
    `${teamName(g, leftTeam)}: ${deltas.map((d) => d[leftTeam]).join(' ')} ${g.score[leftTeam]}`,
  );
  lines.push(
    `${teamName(g, rightTeam)}: ${deltas.map((d) => d[rightTeam]).join(' ')} ${g.score[rightTeam]}`,
  );
  lines.push('');
  lines.push(boxScoreText(teamOf(leftTeam)));
  lines.push('');
  lines.push(boxScoreText(teamOf(rightTeam)));
  lines.push('');
  lines.push('Game log');
  g.log.forEach((e) => {
    lines.push(`${e.clockText} ${periodLabel(e.period, g.config.numHalves)} – ${e.detail}`);
  });
  return lines.join('\n');
}
```

Then add `buildSummaryText` to the `module.exports` object (`app.js:494-536`) — insert it as a new line anywhere in that list, e.g. right after `playerEff,` (the last entry):

```js
    fmtMinutes,
    playerEff,
    buildSummaryText,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="buildSummaryText produces the full plain-text game summary"`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 64`, `pass 64`, `fail 0` (63 existing + 1 new).

- [ ] **Step 6: Commit**

```bash
git add app.js logic.test.js
git commit -m "Add buildSummaryText for full plain-text game summary export"
```

---

### Task 2: Wire the Share button to share a full-summary file

**Files:**
- Modify: `app.js` — `renderSummary()`'s Share handler (currently `app.js:1143-1151`).

**Interfaces:**
- Consumes: `buildSummaryText(g, leftTeam, rightTeam, deltas)` from Task 1 (already in scope inside `renderSummary()`, since `g`, `leftTeam`, `rightTeam`, `deltas` are all local variables computed at the top of that function).

- [ ] **Step 1: Replace the Share handler**

Find:

```js
  const share = document.getElementById('sum-share');
  if (share && !share.hidden)
    share.onclick = () =>
      navigator
        .share({
          title: `${g.myTeam.name} vs ${g.oppTeam.name}`,
          text: `${g.myTeam.name} ${g.score.my} – ${g.score.opp} ${g.oppTeam.name}`,
        })
        .catch(() => {});
```

Replace with:

```js
  const share = document.getElementById('sum-share');
  if (share && !share.hidden)
    share.onclick = () => {
      const text = buildSummaryText(g, leftTeam, rightTeam, deltas);
      const title = `${g.myTeam.name} vs ${g.oppTeam.name}`;
      const filename = `${g.myTeam.name}-vs-${g.oppTeam.name}`.replace(/[^a-z0-9-]+/gi, '-') + '.txt';
      const file = new File([text], filename, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title }).catch(() => {});
      } else {
        navigator.share({ title, text }).catch(() => {});
      }
    };
```

- [ ] **Step 2: Verify scope**

Run: `git diff app.js`
Expected: the Share handler block shown above is the only change in this task's diff (Task 1's `boxScoreText`/`buildSummaryText`/export addition should already be committed separately). No other function in `renderSummary()` (the `sum-print`/`sum-new` handlers, the HTML template) differs.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 64`, `pass 64`, `fail 0` — the Share handler itself is DOM-driven (not exported/pure), so this only confirms Task 1's coverage still holds and nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "Share a full game-summary file instead of a one-line blurb"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

The Share button's click wiring (file construction, `canShare`/fallback branching) is DOM-driven with no automated coverage — matches this codebase's existing precedent. Since this sandbox has no browser available, ask the user to verify in the actual app:

1. On iPhone, finish a game, tap Share, choose "Save to Files" — the saved file should be a `.txt` file containing the full summary (title, score, period table, both box scores, game log), not a few bytes.
2. Sharing to Messages/another app should still work and show a preview of a text file (not raw text pasted into the message body), since it's now shared as a `File`.
3. On a browser/OS where `navigator.canShare({files})` isn't supported (or `navigator.share` itself isn't, in which case the Share button stays hidden as it always has), Share should still fall back to sharing the full summary as plain `text` (not just the old one-liner) where `navigator.share` alone is supported.
