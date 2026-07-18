# Swap Home/Away Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small `⇄` button next to the left team's name on the live game screen that swaps which team displays on the left vs. right, undoable and logged like every other mutating game action.

**Architecture:** One new pure function `swapHomeAway(game, nowMs)` flips `g.config.myTeamSide` (the sole field driving left/right display order) and logs a `rev`-carrying entry; `undo()` gains a matching branch. The Setup-screen render already derives `leftTeam`/`rightTeam` from this field every render, so no other state needs to change. A small button and one click handler wire it into the existing game screen.

**Tech Stack:** Vanilla JS single file (`app.js`), `node --test` (no framework), Prettier via `npx` (no install).

**Spec:** `docs/superpowers/specs/2026-07-17-swap-home-away-design.md`

## Global Constraints

- No build step, no dependencies, no `package.json` — nothing gets installed.
- Pure logic functions take `nowMs` as a parameter; never call `Date.now()` inside them (shell handlers may).
- Anything tests reach must be added to the `module.exports` shim in `app.js` (block starting `// ===== EXPORT SHIM`).
- Every mutating game action needs a `rev` shape and a branch in `undo()` — see `CLAUDE.md`.
- No hardcoded colors in CSS — override/inherit existing custom properties. The `.gh` header bar is a documented, intentional exception (`background:#111; color:#fff` to force a dark scoreboard look in both themes) — new header elements should inherit from it, not introduce a new hardcoded color.
- After editing `app.js`, `styles.css`, or `logic.test.js`, run `npx prettier --write app.js styles.css logic.test.js` before committing.
- Run the full suite with `node --test` from the repo root; all pre-existing tests must stay green (75 before this plan).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `swapHomeAway` logic + undo support

**Files:**
- Modify: `app.js` — insert `swapHomeAway` after `togglePossession` (currently `app.js:330-344`); add an `else if (rev.kind === 'swaphomeaway')` branch inside `undo()` (currently `app.js:411-444`, branches run from line 420 to 442); add `swapHomeAway` to `module.exports` (block starting `app.js:589`, alongside `togglePossession,` at line 609).
- Test: `logic.test.js` — append near the existing possession tests (`logic.test.py:246-258` region) or at the end of the file; either is fine since tests don't depend on file position.

**Interfaces:**
- Consumes: `clone(game)` (structuredClone wrapper), `pushLog(game, entry, nowMs)` (existing — appends a log entry with a `rev`), `freshGame()` test fixture (`logic.test.js:89-95`, builds a game with `config.myTeamSide: 'home'`).
- Produces: `swapHomeAway(game, nowMs)` → returns a new `game` with `config.myTeamSide` flipped (`'home'` ⇄ `'away'`) and a new last log entry `{ type: 'swap_sides', detail: 'Home/Away swapped', rev: { kind: 'swaphomeaway', prev } }`. Task 2 calls this exact function via `commit()`.

- [ ] **Step 1: Write the failing tests** — append to `logic.test.js`:

```js
const { swapHomeAway } = app;

test('swapHomeAway flips config.myTeamSide and logs', () => {
  let g = freshGame();
  assert.strictEqual(g.config.myTeamSide, 'home');
  g = swapHomeAway(g, 1000);
  assert.strictEqual(g.config.myTeamSide, 'away');
  assert.strictEqual(g.log[0].type, 'swap_sides');
  assert.strictEqual(g.log[0].detail, 'Home/Away swapped');
  g = swapHomeAway(g, 2000);
  assert.strictEqual(g.config.myTeamSide, 'home');
  assert.strictEqual(g.log.length, 2);
});

test('undo reverses a home/away swap', () => {
  let g = swapHomeAway(freshGame(), 1000);
  assert.strictEqual(g.config.myTeamSide, 'away');
  g = undo(g);
  assert.strictEqual(g.config.myTeamSide, 'home');
  assert.strictEqual(g.log.length, 0);
});

test('sequential swap-then-swap-back both undo cleanly', () => {
  let g = swapHomeAway(freshGame(), 1000); // home -> away
  g = swapHomeAway(g, 2000); // away -> home
  assert.strictEqual(g.config.myTeamSide, 'home');
  g = undo(g); // undo second swap
  assert.strictEqual(g.config.myTeamSide, 'away');
  assert.strictEqual(g.log.length, 1);
  g = undo(g); // undo first swap
  assert.strictEqual(g.config.myTeamSide, 'home');
  assert.strictEqual(g.log.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="swap"`
Expected: 3 failing tests — `TypeError: swapHomeAway is not a function` (it's `undefined` until implemented and exported).

- [ ] **Step 3: Write minimal implementation** — in `app.js`, directly after the `togglePossession` function (after its closing `}` at line 344, before `function setPossession`):

```js
function swapHomeAway(game, nowMs) {
  let g = clone(game);
  const prev = g.config.myTeamSide;
  g.config.myTeamSide = prev === 'home' ? 'away' : 'home';
  g = pushLog(
    g,
    { type: 'swap_sides', detail: 'Home/Away swapped', rev: { kind: 'swaphomeaway', prev } },
    nowMs,
  );
  return g;
}
```

Then, inside `undo()`, add a new branch. The `sub` branch currently ends the `if/else if` chain like this (`app.js:434-443`):

```js
  } else if (rev.kind === 'sub') {
    const t = rev.team === 'my' ? g.myTeam : g.oppTeam;
    const p = findPlayer(t, rev.playerId);
    if (p) {
      p.onCourt = rev.onCourt;
      p.inClock = rev.inClock;
      p.courtSecs -= rev.courtSecsDelta;
    }
  }
  return g;
}
```

Change it to add a new branch between the `sub` block's closing `}` and `return g;`:

```js
  } else if (rev.kind === 'sub') {
    const t = rev.team === 'my' ? g.myTeam : g.oppTeam;
    const p = findPlayer(t, rev.playerId);
    if (p) {
      p.onCourt = rev.onCourt;
      p.inClock = rev.inClock;
      p.courtSecs -= rev.courtSecsDelta;
    }
  } else if (rev.kind === 'swaphomeaway') {
    g.config.myTeamSide = rev.prev;
  }
  return g;
}
```

Finally, add `swapHomeAway,` to the `module.exports = { ... }` list, next to `togglePossession,` (line 609).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --test-name-pattern="swap"` → 3 pass.
Run: `node --test` → all tests pass (78 expected: 75 existing + 3 new).

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write app.js logic.test.js
node --test
git add app.js logic.test.js
git commit -m "Add swapHomeAway: undoable home/away swap for the live game screen

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Swap button — UI, CSS, wiring

**Files:**
- Modify: `app.js` — `renderGame()`'s left `.score-box` template (currently `app.js:1499-1520`, specifically the left team's `.tn` line at `app.js:1502`); `wireGame()` (currently starts `app.js:1617`, add alongside the existing `$('poss')` handler around `app.js:1682`).
- Modify: `styles.css` — add a `.swapbtn` rule near `.gh`/`.score-box` (currently `styles.css:330-347`).

**Interfaces:**
- Consumes: `swapHomeAway(game, nowMs)` from Task 1 (exact signature above); existing `commit(producer)` shell helper (calls `producer(state.game, Date.now())`, saves, re-renders); existing `esc()`, `teamName()` helpers already used in `renderGame()`.
- Produces: user-facing UI only; nothing downstream consumes it.

No unit tests: this is DOM shell code, which this codebase deliberately leaves to manual verification (same precedent as other button wiring).

- [ ] **Step 1: Add the button to the left team's name** — in `app.js`, inside `renderGame()`'s template literal, find the left `.score-box` block:

```html
      <div class="score-box">
        <div class="tn">${esc(teamName(g, leftTeam))}</div>
        <div class="sc" data-actlog="score:${leftTeam}">${g.score[leftTeam]}</div>
```

Change the `.tn` line to:

```html
      <div class="score-box">
        <div class="tn">${esc(teamName(g, leftTeam))} <button id="btn-swap-sides" class="swapbtn" title="Swap Home/Away">⇄</button></div>
        <div class="sc" data-actlog="score:${leftTeam}">${g.score[leftTeam]}</div>
```

Do **not** make the equivalent change to the right `.score-box` — only the left team's name gets the button, per the spec (single global action, fixed position).

- [ ] **Step 2: Add the CSS rule** — in `styles.css`, directly after the `.score-box .sc` rule (ends at line 347):

```css
.swapbtn {
  background: none;
  border: none;
  color: inherit;
  font-size: 1rem;
  padding: 0 0 0 4px;
  line-height: 1;
  vertical-align: middle;
}
```

- [ ] **Step 3: Wire the click handler** — in `app.js`, inside `wireGame()`, directly after the existing line (`app.js:1682`):

```js
  $('poss') && ($('poss').onclick = () => commit((game, now) => togglePossession(game, now)));
```

add:

```js
  $('btn-swap-sides') &&
    ($('btn-swap-sides').onclick = () => commit((game, now) => swapHomeAway(game, now)));
```

- [ ] **Step 4: Verify nothing regressed**

Run: `node --test` → all pass (same 78 as Task 1; this task adds no unit tests).
Optional smoke check in a browser (`python -m http.server`, open `index.html`): start a game, the `⇄` button appears right after the left team's name; tapping it swaps team names/scores/fouls/timeouts/player columns to the opposite sides, adds "Home/Away swapped" to the game log, and the UNDO button reverses it cleanly.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write app.js styles.css
node --test
git add app.js styles.css
git commit -m "Add swap-sides button to the game screen header

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual verification (user, after both tasks)

1. Start a game, note which team is on the left, tap `⇄` — teams, scores, fouls, timeouts, and player columns all flip sides; the possession arrow (`◀`/`▶`) still points at whichever team currently has possession.
2. Tap UNDO — everything flips back, and the "Home/Away swapped" log entry disappears.
3. Swap, then end the game and check the Final summary screen — it reflects the last swap state (it derives from the same `config.myTeamSide`).
4. Confirm the button reads clearly in both light and dark app themes (the header itself stays dark scoreboard-style regardless of theme, per existing design).
