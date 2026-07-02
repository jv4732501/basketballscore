# Edit Player (Number/Name) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player's jersey number and name be edited both during a live game (double-click a player) and from the Team Editor (double-click a roster row).

**Architecture:** Three tasks. Task 1 adds the pure `editPlayer` function with unit tests. Task 2 wires in-game double-click detection and the in-game edit dialog (depends on Task 1's `editPlayer`), plus shared dialog-input CSS. Task 3 wires the Team Editor's double-click and its own edit dialog (independent of `editPlayer` — it edits an in-memory draft, not a live game).

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), Node's built-in test runner (`node --test`) for `editPlayer`'s unit tests.

## Global Constraints

- `editPlayer(game, team, id, { num, name })` only ever changes `num` and `name` on the matching player — no stat fields, no other player.
- In-game: if `team === 'my'`, saving also updates the matching player in the saved `state.teams` roster and calls `saveTeams()`. If `team === 'opp'`, the edit is game-only (opponent players are never persisted anywhere in this app).
- Team Editor: saving only mutates the in-memory `teamEdit.players[i]` draft and calls `renderTeams()` — it must NOT call `saveTeams()` or otherwise persist immediately; persistence only happens when the editor's own "Save" button (`#te-save`) is tapped, exactly like removing a player from this screen already behaves.
- The Setup screen's roster previews (`renderRoster` called with `which` = `'my'`/`'opp'`, not `'te'`) are not touched — no edit affordance added there.
- The existing long-press (Activity/Sub In-Out) flow and existing Team Editor `[data-rm]` removal wiring are unaffected.

---

### Task 1: `editPlayer` pure function + unit tests

**Files:**
- Modify: `app.js:420-425` (add `editPlayer` immediately after `addPlayerToGame`), `app.js:511` (export shim — add `editPlayer` immediately after `addPlayerToGame` in the list)
- Test: `logic.test.js` (add tests immediately after the existing `addPlayerToGame` tests, around line 537)

**Interfaces:**
- Produces: `editPlayer(game, team, id, { num, name })` — returns a new game object with the matching player's `num`/`name` updated; returns the same `game` unchanged if no player with that `id` exists on that team. Later tasks (Task 2) call this via `commit((game) => editPlayer(game, team, id, { num, name }))`.

- [ ] **Step 1: Write the failing tests**

In `logic.test.js`, find:

```js
test('addPlayerToGame can add to the opponent', () => {
  const g = addPlayerToGame(freshGame(), 'opp', { id: 'o9', num: 7, name: '' });
  assert.strictEqual(g.oppTeam.players.length, 2);
  assert.strictEqual(g.oppTeam.players[1].num, 7);
  assert.strictEqual(g.myTeam.players.length, 1);
});
```

Add immediately after it:

```js
const { editPlayer } = app;

test('editPlayer updates an existing my-team player number and name', () => {
  const g0 = freshGame();
  const g = editPlayer(g0, 'my', 'p1', { num: 34, name: 'Jones' });
  assert.strictEqual(g0.myTeam.players[0].num, 5); // input not mutated
  assert.strictEqual(g.myTeam.players[0].num, 34);
  assert.strictEqual(g.myTeam.players[0].name, 'Jones');
});

test('editPlayer updates an existing opponent player', () => {
  const g = editPlayer(freshGame(), 'opp', 'o1', { num: 12, name: 'Doe' });
  assert.strictEqual(g.oppTeam.players[0].num, 12);
  assert.strictEqual(g.oppTeam.players[0].name, 'Doe');
});

test('editPlayer is a no-op for an unknown id', () => {
  const g0 = freshGame();
  const g = editPlayer(g0, 'my', 'nope', { num: 99, name: 'Ghost' });
  assert.strictEqual(g, g0); // unchanged input returned as-is
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-name-pattern="editPlayer" 2>&1 | tail -20`
Expected: FAIL — `editPlayer is not defined` or `Cannot read properties of undefined`, since `editPlayer` doesn't exist yet in `app.js` or its export list.

- [ ] **Step 3: Implement `editPlayer`**

In `app.js`, find:

```js
function addPlayerToGame(game, team, { id, num, name }) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  t.players.push({ id, num, name, ...emptyMyStats() });
  return g;
}
```

Add immediately after it:

```js
function editPlayer(game, team, id, { num, name }) {
  const g = clone(game);
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return game;
  p.num = num;
  p.name = name;
  return g;
}
```

- [ ] **Step 4: Add `editPlayer` to the export shim**

In `app.js`, find:

```js
    teamToSave,
    addPlayerToGame,
    serialize,
```

Replace with:

```js
    teamToSave,
    addPlayerToGame,
    editPlayer,
    serialize,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test --test-name-pattern="editPlayer" 2>&1 | tail -20`
Expected: 3 tests passing (`editPlayer updates an existing my-team player number and name`, `editPlayer updates an existing opponent player`, `editPlayer is a no-op for an unknown id`).

- [ ] **Step 6: Run the full suite**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` (60 existing + 3 new).

- [ ] **Step 7: Commit**

```bash
git add app.js logic.test.js
git commit -m "Add editPlayer pure function with tests"
```

---

### Task 2: In-game double-click edit dialog

**Files:**
- Modify: `app.js:1580-1611` (`attachPlayerPress`'s `onclick`), and add a new function `openPlayerEditDialog` immediately before `function closeActivityDialog() {` (currently around line 1676)
- Modify: `styles.css` (add `.dialog label` and `.dialog input` rules, e.g. right after the existing `.dialog h3` rule)

**Interfaces:**
- Consumes: `editPlayer(game, team, id, { num, name })` from Task 1 (`app.js`, exported via `module.exports` — but called directly as a same-file function, not through the export shim, since this is all within `app.js` itself).
- Produces: `openPlayerEditDialog(team, id)` — opens the in-game edit dialog. Not consumed by Task 3 (Task 3 has its own separate dialog function).

- [ ] **Step 1: Add click-vs-double-click handling to `attachPlayerPress`**

In `app.js`, find:

```js
function attachPlayerPress(btn) {
  const [team, id] = btn.dataset.pl.split(':');
  let timer = null,
    longFired = false;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => {
      longFired = true;
      openPlayerMenu(btn, team, id);
    }, 500);
  };
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  btn.addEventListener('touchstart', start, { passive: true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress long-press browser menu
  btn.onclick = () => {
    if (longFired) {
      longFired = false;
      return;
    }
    state.game.selectedPlayerId = state.game.selectedPlayerId === id ? null : id;
    saveGame();
    render();
  };
}
```

Replace with:

```js
function attachPlayerPress(btn) {
  const [team, id] = btn.dataset.pl.split(':');
  let timer = null,
    longFired = false,
    clickTimer = null;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => {
      longFired = true;
      openPlayerMenu(btn, team, id);
    }, 500);
  };
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  btn.addEventListener('touchstart', start, { passive: true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress long-press browser menu
  btn.onclick = () => {
    if (longFired) {
      longFired = false;
      return;
    }
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      openPlayerEditDialog(team, id);
      return;
    }
    clickTimer = setTimeout(() => {
      clickTimer = null;
      state.game.selectedPlayerId = state.game.selectedPlayerId === id ? null : id;
      saveGame();
      render();
    }, 300);
  };
}
```

(Only `let timer = null, longFired = false;` gained a third variable, `clickTimer = null;`, and the `onclick` body gained the double-click branch before the existing selection-toggle logic, which now runs inside a 300ms `setTimeout` instead of immediately.)

- [ ] **Step 2: Add `openPlayerEditDialog`**

In `app.js`, find:

```js
function closeActivityDialog() {
```

Add the new function immediately **before** it:

```js
function openPlayerEditDialog(team, id) {
  const g = state.game;
  const t = team === 'my' ? g.myTeam : g.oppTeam;
  const p = t.players.find((x) => x.id === id);
  if (!p) return;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>Edit Player</h3><div class="dlgbody"><label>Number <input id="pe-num" type="number" inputmode="numeric" value="${p.num}"></label><label>Name <input id="pe-name" value="${esc(p.name || '')}"></label><p id="pe-error" class="error"></p></div><div class="tip-row"><button id="pe-save" class="tip">Save</button><button id="pe-cancel">Cancel</button></div>`;
  document.body.appendChild(back);
  document.body.appendChild(dlg);
  dlg.querySelector('#pe-save').onclick = () => {
    const num = parseInt(dlg.querySelector('#pe-num').value, 10);
    if (isNaN(num)) {
      dlg.querySelector('#pe-error').textContent = 'Enter a jersey number.';
      return;
    }
    const name = dlg.querySelector('#pe-name').value.trim();
    commit((game) => editPlayer(game, team, id, { num, name }));
    if (team === 'my') {
      const st = state.teams.find((x) => x.id === state.game.myTeam.id);
      const sp = st && st.players.find((x) => x.id === id);
      if (sp) {
        sp.num = num;
        sp.name = name;
        saveTeams();
      }
    }
    closeActivityDialog();
  };
  dlg.querySelector('#pe-cancel').onclick = closeActivityDialog;
}

function closeActivityDialog() {
```

- [ ] **Step 3: Add dialog input/label CSS**

In `styles.css`, find:

```css
.dialog h3 {
  margin: 0 0 8px;
}
```

Add immediately after it:

```css
.dialog h3 {
  margin: 0 0 8px;
}

.dialog label {
  display: block;
  margin: 8px 0;
  font-size: 0.9rem;
}

.dialog input {
  width: 100%;
  padding: 10px;
  font-size: 1rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
}
```

- [ ] **Step 4: Run the full test suite**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — this task adds no new pure-function logic (only UI wiring + a dialog), so the count from the end of Task 1 must be unchanged.

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css
git commit -m "Add in-game double-click edit dialog for players"
```

- [ ] **Step 6: Manual verification (deferred to the user)**

There is no automated test for the dialog/click-handling code itself (UI-interaction code with no pure-function equivalent — matches the precedent set by the existing player Activity dialog and the MISS lock feature). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. A single tap on a player still selects them (after a brief delay) exactly as before.
2. Double-clicking a player (either team) opens an "Edit Player" dialog pre-filled with their current number/name.
3. Saving a valid number/name updates the player immediately in the game.
4. For my team, the change is also reflected next time that team is opened in the Team Editor.
5. Saving with a blank/invalid number shows "Enter a jersey number." and does not close the dialog.
6. Cancel closes the dialog with no changes.
7. The existing long-press (Activity/Sub In-Out) flow still works unchanged.

---

### Task 3: Team Editor double-click edit dialog

**Files:**
- Modify: `app.js:738-749` (`renderRoster`), `app.js:904-960` (`renderTeamEditor` — add `[data-editpl]` wiring), and add a new function `openRosterEditDialog` immediately before `function closeActivityDialog() {`
- Modify: `styles.css` (add `.editpl { cursor: pointer; }`)

**Interfaces:**
- Consumes: `.dialog label`/`.dialog input` CSS from Task 2 (already in place; this task's dialog reuses them, no new CSS needed for the dialog body itself).
- Produces: `openRosterEditDialog(i)` — operates on `teamEdit.players[i]` directly, not consumed elsewhere.

- [ ] **Step 1: Update `renderRoster` to wrap `'te'` rows in an editable span**

In `app.js`, find:

```js
function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">No players yet</p>`;
  return (
    `<ul class="roster">` +
    players
      .map(
        (p, i) =>
          `<li>#${p.num} ${esc(p.name || '')}<button data-rm="${which}:${i}" class="rm">×</button></li>`,
      )
      .join('') +
    `</ul>`
  );
}
```

Replace with:

```js
function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">No players yet</p>`;
  return (
    `<ul class="roster">` +
    players
      .map(
        (p, i) =>
          `<li>${
            which === 'te'
              ? `<span class="editpl" data-editpl="${which}:${i}">#${p.num} ${esc(p.name || '')}</span>`
              : `#${p.num} ${esc(p.name || '')}`
          }<button data-rm="${which}:${i}" class="rm">×</button></li>`,
      )
      .join('') +
    `</ul>`
  );
}
```

This only changes rendering when `which === 'te'` (the Team Editor). The Setup screen's calls (`renderRoster(d.myPlayers, 'my')`, `renderRoster(d.oppPlayers, 'opp')`) render identically to before — plain `#num name` text, no span, no `data-editpl`.

- [ ] **Step 2: Wire `[data-editpl]` in `renderTeamEditor`**

In `app.js`, inside `renderTeamEditor`, find:

```js
  el_each(
    '[data-rm]',
    (b) =>
      (b.onclick = () => {
        const [, i] = b.dataset.rm.split(':'); // "te:i"
        d.players.splice(parseInt(i, 10), 1);
        renderTeams();
      }),
  );
```

Add immediately after it:

```js
  el_each('[data-editpl]', (b) =>
    b.addEventListener('dblclick', () => {
      const [, i] = b.dataset.editpl.split(':'); // "te:i"
      openRosterEditDialog(parseInt(i, 10));
    }),
  );
```

- [ ] **Step 3: Add `openRosterEditDialog`**

In `app.js`, find:

```js
function closeActivityDialog() {
```

Add the new function immediately **before** it (if Task 2's `openPlayerEditDialog` is already there, add this one directly above `closeActivityDialog` too, after `openPlayerEditDialog`):

```js
function openRosterEditDialog(i) {
  const d = teamEdit;
  const p = d.players[i];
  if (!p) return;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>Edit Player</h3><div class="dlgbody"><label>Number <input id="pe-num" type="number" inputmode="numeric" value="${p.num}"></label><label>Name <input id="pe-name" value="${esc(p.name || '')}"></label><p id="pe-error" class="error"></p></div><div class="tip-row"><button id="pe-save" class="tip">Save</button><button id="pe-cancel">Cancel</button></div>`;
  document.body.appendChild(back);
  document.body.appendChild(dlg);
  dlg.querySelector('#pe-save').onclick = () => {
    const num = parseInt(dlg.querySelector('#pe-num').value, 10);
    if (isNaN(num)) {
      dlg.querySelector('#pe-error').textContent = 'Enter a jersey number.';
      return;
    }
    p.num = num;
    p.name = dlg.querySelector('#pe-name').value.trim();
    closeActivityDialog();
    renderTeams();
  };
  dlg.querySelector('#pe-cancel').onclick = closeActivityDialog;
}
```

Note: this function does NOT call `saveTeams()` or `commit()` — it only mutates the in-memory `teamEdit` draft and re-renders the Teams screen. Persistence happens only when the Team Editor's own `#te-save` button is tapped (existing code, unchanged by this task).

- [ ] **Step 4: Add `.editpl` CSS**

In `styles.css`, find the `.dialog input` rule added in Task 2:

```css
.dialog input {
  width: 100%;
  padding: 10px;
  font-size: 1rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
}
```

Add immediately after it:

```css
.dialog input {
  width: 100%;
  padding: 10px;
  font-size: 1rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
}

.editpl {
  cursor: pointer;
}
```

- [ ] **Step 5: Run the full test suite**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — no new pure-function logic in this task, count unchanged from Task 2.

- [ ] **Step 6: Commit**

```bash
git add app.js styles.css
git commit -m "Add double-click edit dialog to Team Editor roster rows"
```

- [ ] **Step 7: Manual verification (deferred to the user)**

There is no automated test for this dialog/wiring code (matches the precedent from Task 2). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. In the Team Editor (Teams tab → edit a team), double-clicking a player row opens an "Edit Player" dialog pre-filled with their current number/name.
2. Saving a valid number/name updates that row immediately in the editor.
3. The overall team is NOT persisted to the saved roster until the editor's own "Save" button is tapped — closing/reopening the editor without tapping Save should not keep the edit (matching how removing a player already behaves).
4. Saving with a blank/invalid number shows "Enter a jersey number." and does not close the dialog.
5. Cancel closes the dialog with no changes.
6. The Setup screen's roster previews (before starting a game) are unaffected — no double-click behavior there, and the `×` remove button still works everywhere it did before.
