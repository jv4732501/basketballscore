# Export/Import Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-tap export of all HoopScore data (teams, history, in-progress game) to a single `.json` file, and a merge-based import that restores it — so clearing browser data no longer loses everything.

**Architecture:** Three new pure functions (`buildBackup`, `validateBackup`, `mergeBackup`) go in `app.js`'s game-logic section next to `serialize`/`isResumable`, exported through the existing test shim and unit-tested in `logic.test.js`. The DOM shell gets a "Backup" card at the bottom of the Setup view with Export (share sheet on phone, `<a download>` fallback on desktop) and Import (on-the-fly `<input type="file">` + `FileReader`) buttons wired in `wireSetup`.

**Tech Stack:** Vanilla JS single file (`app.js`), `node --test` (no framework), Prettier via `npx` (no install).

**Spec:** `docs/superpowers/specs/2026-07-17-export-import-backup-design.md`

## Global Constraints

- No build step, no dependencies, no `package.json` — nothing gets installed.
- Pure logic functions take `nowMs` as a parameter; never call `Date.now()` inside them (shell handlers may).
- Anything tests reach must be added to the `module.exports` shim in `app.js` (the block starting `// ===== EXPORT SHIM`).
- After editing `app.js`, `logic.test.js`, or `styles.css`, run `npx prettier --write app.js logic.test.js styles.css` before committing.
- No hardcoded colors in CSS — use existing custom properties (`--surface`, etc.). The new CSS below adds layout only.
- Run the full suite with `node --test` from the repo root; all pre-existing tests must stay green.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `buildBackup` (pure export builder)

**Files:**
- Modify: `app.js` — insert function after `isResumable` (just before the `// ===== EXPORT SHIM` comment, ~line 517); add `buildBackup` to the `module.exports` list.
- Test: `logic.test.js` — append at end of file.

**Interfaces:**
- Consumes: `clone(value)` (structuredClone wrapper, already in `app.js`).
- Produces: `buildBackup(state, nowMs)` → `{ app: 'hoopscore', formatVersion: 1, exportedAt: <ISO string>, teams: <deep copy>, history: <deep copy>, game: <deep copy>|null }`. Tasks 3 and 4 rely on this exact shape.

- [ ] **Step 1: Write the failing test** — append to `logic.test.js`:

```js
const { buildBackup } = app;

test('buildBackup wraps state with app marker, version, timestamp, and deep copies', () => {
  const st = {
    teams: [{ id: 't1', name: 'Mine', players: [{ id: 'p1', num: 5, name: 'Smith' }] }],
    history: [],
    game: null,
  };
  const b = buildBackup(st, 1750000000000);
  assert.strictEqual(b.app, 'hoopscore');
  assert.strictEqual(b.formatVersion, 1);
  assert.strictEqual(b.exportedAt, new Date(1750000000000).toISOString());
  assert.deepStrictEqual(b.teams, st.teams);
  assert.deepStrictEqual(b.history, []);
  assert.strictEqual(b.game, null);
  b.teams[0].name = 'Changed'; // must not leak back into state
  assert.strictEqual(st.teams[0].name, 'Mine');
});

test('buildBackup includes an in-progress game when present', () => {
  const g = freshGame();
  const b = buildBackup({ teams: [], history: [], game: g }, 2000);
  assert.deepStrictEqual(b.game, g);
  assert.notStrictEqual(b.game, g); // copy, not the same reference
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="buildBackup"`
Expected: 2 failing tests — `TypeError: buildBackup is not a function` (it's `undefined` until exported).

- [ ] **Step 3: Write minimal implementation** — in `app.js`, directly after the `isResumable` function:

```js
function buildBackup(state, nowMs) {
  return {
    app: 'hoopscore',
    formatVersion: 1,
    exportedAt: new Date(nowMs).toISOString(),
    teams: clone(state.teams),
    history: clone(state.history),
    game: state.game ? clone(state.game) : null,
  };
}
```

and add `buildBackup,` to the `module.exports = { ... }` list (anywhere in the list; convention is roughly source order, so after `isResumable,`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --test-name-pattern="buildBackup"` → 2 pass.
Run: `node --test` → all tests pass (69 expected: 67 existing + 2 new).

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write app.js logic.test.js
node --test
git add app.js logic.test.js
git commit -m "Add buildBackup: pure builder for the export backup object

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `validateBackup` (parse-time validation + migration)

**Files:**
- Modify: `app.js` — insert function after `buildBackup`; add `validateBackup` to `module.exports`.
- Test: `logic.test.js` — append at end of file.

**Interfaces:**
- Consumes: `migrateGame(game)` (existing; folds legacy `reb` into `dreb`, fills missing stat fields, tolerates `null`).
- Produces: `validateBackup(obj)` → `{ ok: true, backup: { teams, history, game } }` (games already migrated, fields defaulted) or `{ ok: false, reason: <user-facing string> }`. Task 3's `mergeBackup` takes `result.backup`; Task 4 alerts `result.reason`.

- [ ] **Step 1: Write the failing tests** — append to `logic.test.js`:

```js
const { validateBackup } = app;

test('validateBackup rejects non-backups, bad shapes, and newer versions', () => {
  for (const bad of [null, 42, 'x', {}, { app: 'other' }]) {
    const r = validateBackup(bad);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /Not a HoopScore backup/);
  }
  const newer = validateBackup({ app: 'hoopscore', formatVersion: 2 });
  assert.strictEqual(newer.ok, false);
  assert.match(newer.reason, /newer version/);
  assert.strictEqual(validateBackup({ app: 'hoopscore', teams: 'nope' }).ok, false);
  assert.strictEqual(validateBackup({ app: 'hoopscore', history: {} }).ok, false);
});

test('validateBackup defaults missing fields and migrates legacy games', () => {
  const v = validateBackup({ app: 'hoopscore', formatVersion: 1 });
  assert.strictEqual(v.ok, true);
  assert.deepStrictEqual(v.backup.teams, []);
  assert.deepStrictEqual(v.backup.history, []);
  assert.strictEqual(v.backup.game, null);

  const legacy = clone(freshGame());
  legacy.myTeam.players[0].reb = 3; // legacy single-rebound field
  const v2 = validateBackup({ app: 'hoopscore', formatVersion: 1, history: [legacy], game: clone(legacy) });
  assert.strictEqual(v2.ok, true);
  assert.strictEqual(v2.backup.history[0].myTeam.players[0].dreb, 3);
  assert.strictEqual('reb' in v2.backup.history[0].myTeam.players[0], false);
  assert.strictEqual(v2.backup.game.myTeam.players[0].dreb, 3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="validateBackup"`
Expected: 2 failing tests — `validateBackup is not a function`.

- [ ] **Step 3: Write minimal implementation** — in `app.js`, directly after `buildBackup`:

```js
function validateBackup(obj) {
  const notBackup = { ok: false, reason: 'Not a HoopScore backup file.' };
  if (!obj || typeof obj !== 'object' || obj.app !== 'hoopscore') return notBackup;
  if (typeof obj.formatVersion === 'number' && obj.formatVersion > 1)
    return { ok: false, reason: 'This backup was made by a newer version of HoopScore.' };
  const teams = obj.teams ?? [];
  const history = obj.history ?? [];
  if (!Array.isArray(teams) || !Array.isArray(history)) return notBackup;
  return {
    ok: true,
    backup: {
      teams,
      history: history.map((g) => migrateGame(g)),
      game: obj.game ? migrateGame(obj.game) : null,
    },
  };
}
```

and add `validateBackup,` to `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --test-name-pattern="validateBackup"` → 2 pass.
Run: `node --test` → all pass (71 expected).

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write app.js logic.test.js
node --test
git add app.js logic.test.js
git commit -m "Add validateBackup: reject non-backups, default fields, migrate games

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `mergeBackup` (merge semantics + summary counts)

**Files:**
- Modify: `app.js` — insert function after `validateBackup`; add `mergeBackup` to `module.exports`.
- Test: `logic.test.js` — append at end of file.

**Interfaces:**
- Consumes: `upsertHistory(history, game)` and `isResumable(game)` (both existing); `buildBackup`/`validateBackup` from Tasks 1–2 (round-trip test only).
- Produces: `mergeBackup(state, backup)` → `{ state: { teams, history, game }, summary: { teamsAdded, teamsUpdated, gamesAdded, gamesUpdated, gameRestored, gameSkipped } }`. `state` here is only the three data fields (never `theme`); input `state` is not mutated. Task 4 assigns the three fields back and builds the alert from `summary`.

- [ ] **Step 1: Write the failing tests** — append to `logic.test.js`:

```js
const { mergeBackup } = app;

test('export/import round-trip: backup restores an empty browser exactly', () => {
  const team = { id: 't1', name: 'Mine', players: [{ id: 'p1', num: 5, name: 'Smith' }] };
  const done = endGame(startClock(freshGame(), 1000), 61000);
  const src = { teams: [team], history: [done], game: null };
  const parsed = deserialize(serialize(buildBackup(src, 99000)));
  const v = validateBackup(parsed);
  assert.strictEqual(v.ok, true);
  const { state: merged, summary } = mergeBackup({ teams: [], history: [], game: null }, v.backup);
  assert.deepStrictEqual(merged.teams, src.teams);
  assert.deepStrictEqual(merged.history, src.history);
  assert.strictEqual(merged.game, null);
  assert.deepStrictEqual(summary, {
    teamsAdded: 1,
    teamsUpdated: 0,
    gamesAdded: 1,
    gamesUpdated: 0,
    gameRestored: false,
    gameSkipped: false,
  });
});

test('mergeBackup upserts by id: file wins on conflict, nothing local deleted', () => {
  const local = {
    teams: [
      { id: 't1', name: 'Old Name', players: [] },
      { id: 't2', name: 'Local Only', players: [] },
    ],
    history: [
      { id: 'g1', tag: 'local' },
      { id: 'g2', tag: 'local-only' },
    ],
    game: null,
  };
  const backup = {
    teams: [
      { id: 't1', name: 'New Name', players: [] },
      { id: 't3', name: 'File Only', players: [] },
    ],
    history: [
      { id: 'g1', tag: 'file' },
      { id: 'g3', tag: 'file-only' },
    ],
    game: null,
  };
  const { state: merged, summary } = mergeBackup(local, backup);
  assert.strictEqual(merged.teams.length, 3);
  assert.strictEqual(merged.teams.find((t) => t.id === 't1').name, 'New Name');
  assert.strictEqual(merged.teams.find((t) => t.id === 't2').name, 'Local Only');
  assert.strictEqual(merged.history.length, 3);
  assert.strictEqual(merged.history.find((g) => g.id === 'g1').tag, 'file');
  assert.deepStrictEqual(summary, {
    teamsAdded: 1,
    teamsUpdated: 1,
    gamesAdded: 1,
    gamesUpdated: 1,
    gameRestored: false,
    gameSkipped: false,
  });
  assert.strictEqual(local.teams.length, 2); // input state not mutated
  assert.strictEqual(local.history.length, 2);
});

test('mergeBackup never clobbers a live local game, restores otherwise', () => {
  const fileGame = freshGame(); // screen: 'game' → resumable
  // no local game → restored
  let r = mergeBackup({ teams: [], history: [], game: null }, { teams: [], history: [], game: fileGame });
  assert.deepStrictEqual(r.state.game, fileGame);
  assert.strictEqual(r.summary.gameRestored, true);
  assert.strictEqual(r.summary.gameSkipped, false);
  // local live game → file's game skipped, local kept
  const liveLocal = freshGame();
  r = mergeBackup({ teams: [], history: [], game: liveLocal }, { teams: [], history: [], game: fileGame });
  assert.strictEqual(r.state.game, liveLocal);
  assert.strictEqual(r.summary.gameRestored, false);
  assert.strictEqual(r.summary.gameSkipped, true);
  // local game exists but is on the summary screen (not resumable) → file wins
  const finished = endGame(freshGame(), 1000);
  r = mergeBackup({ teams: [], history: [], game: finished }, { teams: [], history: [], game: fileGame });
  assert.deepStrictEqual(r.state.game, fileGame);
  assert.strictEqual(r.summary.gameRestored, true);
  // backup has no game → local untouched either way
  r = mergeBackup({ teams: [], history: [], game: liveLocal }, { teams: [], history: [], game: null });
  assert.strictEqual(r.state.game, liveLocal);
  assert.strictEqual(r.summary.gameSkipped, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="mergeBackup|round-trip"`
Expected: 3 failing tests — `mergeBackup is not a function`.

- [ ] **Step 3: Write minimal implementation** — in `app.js`, directly after `validateBackup`:

```js
function mergeBackup(state, backup) {
  const teams = state.teams.slice();
  let teamsAdded = 0;
  let teamsUpdated = 0;
  for (const t of backup.teams) {
    const i = teams.findIndex((x) => x.id === t.id);
    if (i >= 0) {
      teams[i] = t;
      teamsUpdated += 1;
    } else {
      teams.push(t);
      teamsAdded += 1;
    }
  }
  let history = state.history;
  let gamesAdded = 0;
  let gamesUpdated = 0;
  for (const g of backup.history) {
    if (history.some((x) => x.id === g.id)) gamesUpdated += 1;
    else gamesAdded += 1;
    history = upsertHistory(history, g);
  }
  let game = state.game;
  let gameRestored = false;
  let gameSkipped = false;
  if (backup.game) {
    if (isResumable(state.game)) {
      gameSkipped = true;
    } else {
      game = backup.game;
      gameRestored = true;
    }
  }
  return {
    state: { teams, history, game },
    summary: { teamsAdded, teamsUpdated, gamesAdded, gamesUpdated, gameRestored, gameSkipped },
  };
}
```

and add `mergeBackup,` to `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --test-name-pattern="mergeBackup|round-trip"` → 3 pass.
Run: `node --test` → all pass (74 expected).

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write app.js logic.test.js
node --test
git add app.js logic.test.js
git commit -m "Add mergeBackup: upsert-by-id merge with live-game protection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Backup UI — Export/Import buttons on the Setup screen

**Files:**
- Modify: `app.js` — `renderSetup` (the template ending with the `start-card` section, ~line 744) and `wireSetup` (~line 816); one new shell helper `importMessage`.
- Modify: `styles.css` — one new layout rule (place near `.resume-actions`, ~line 284).

**Interfaces:**
- Consumes: `buildBackup(state, nowMs)`, `validateBackup(obj)`, `mergeBackup(state, backup)` from Tasks 1–3; existing `serialize`, `deserialize`, `saveTeams`, `saveHistory`, `saveGame`, `render`.
- Produces: user-facing UI only; nothing downstream consumes it. No log entry, no `commit()` — export/import are not undoable game actions.

No unit tests: this is DOM shell code, which this codebase deliberately leaves to manual verification (same precedent as the summary Share button).

- [ ] **Step 1: Add the Backup card to `renderSetup`** — in the template, after the `start-card` section and before the closing backtick:

```html
    <section class="card">
      <h2>Backup</h2>
      <div class="backup-actions">
        <button id="btn-export">Export data</button>
        <button id="btn-import">Import data</button>
      </div>
    </section>
```

(Exact edit: insert between `</section>` of the start-card block and the closing `` ` ``.)

- [ ] **Step 2: Add the layout rule to `styles.css`** — after the `.resume-actions` rule:

```css
.backup-actions {
  display: flex;
  gap: 8px;
}

.backup-actions button {
  flex: 1;
}
```

No colors — buttons keep the global button styling and theme variables.

- [ ] **Step 3: Add `importMessage` helper and wire both buttons** — in `app.js`. First, the helper, placed just above `wireSetup`:

```js
function importMessage(s) {
  const teams = s.teamsAdded + s.teamsUpdated;
  const games = s.gamesAdded + s.gamesUpdated;
  let msg = `Imported ${teams} team${teams === 1 ? '' : 's'} (${s.teamsUpdated} updated) and ${games} game${games === 1 ? '' : 's'} (${s.gamesUpdated} updated).`;
  if (s.gameRestored) msg += ' In-progress game restored.';
  if (s.gameSkipped) msg += " Skipped the backup's in-progress game (a game is already in progress here).";
  return msg;
}
```

Then, inside `wireSetup` (after the `btn-resume`/`btn-discard` lines, following the same `$('id') && (...)` guard style):

```js
$('btn-export') &&
  ($('btn-export').onclick = () => {
    const json = serialize(buildBackup(state, Date.now()));
    const filename = `hoopscore-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'HoopScore backup' }).catch(() => {});
    } else {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

$('btn-import') &&
  ($('btn-import').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = validateBackup(deserialize(reader.result));
        if (!result.ok) {
          alert(result.reason);
          return;
        }
        const { state: merged, summary } = mergeBackup(state, result.backup);
        state.teams = merged.teams;
        state.history = merged.history;
        state.game = merged.game;
        saveTeams();
        saveHistory();
        saveGame();
        alert(importMessage(summary));
        render();
      };
      reader.readAsText(f);
    };
    input.click();
  });
```

Notes for the implementer: the file input is created per tap and never inserted into the DOM, so the full-`innerHTML` re-render cycle can't destroy it mid-use. `render()` runs last so a restored in-progress game routes straight to the game screen.

- [ ] **Step 4: Verify nothing regressed**

Run: `node --test` → all pass (same 74 as Task 3; this task adds no unit tests).
Optional smoke check in a browser (`python -m http.server`, open `index.html`): the Backup card renders at the bottom of New Game with two equal-width buttons; on desktop, Export downloads `hoopscore-backup-<today>.json`; importing that same file alerts the summary counts and nothing duplicates.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write app.js styles.css
node --test
git add app.js styles.css
git commit -m "Add Backup card: export/import all data as a JSON file

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual verification (user, real devices — after all tasks)

1. Phone: Export → share sheet → Save to Files produces a dated `.json` containing teams/history.
2. Clear site data, Import that file → teams and history return; a finished game opens from History.
3. Desktop: Export downloads the file; Import restores it.
4. Import the same file twice → no duplicates; counts reported as "updated".
5. Import a random `.json` → "Not a HoopScore backup file.", nothing changed.
6. ~~Start scoring a game, import a backup containing an in-progress game~~ — not executable: the Backup card lives on the Setup screen, which is unreachable while a game is in progress (see the spec's "Reality note"). The live-game skip rule is covered by unit tests only.
