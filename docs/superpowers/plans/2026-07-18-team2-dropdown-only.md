# Team 2 Dropdown-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Team 2's freeform-or-linked opponent picker with a plain dropdown of saved teams — a second instance of exactly what Team 1 already is. A saved team is now required for both slots; roster editing moves exclusively to the Teams tab for both.

**Architecture:** Team 2's Setup card, `defaultDraft()`, `renderSetup()`'s self-heal, and `startGame()`'s validation are each rewritten to mirror Team 1's existing dropdown/active-roster pattern exactly (reusing `renderActiveRosterFor`, already generalized in the prior cycle). Everything freeform-specific (`findTeamByName`, the datalist, the manual add-player form, `oppName`/`oppPlayers` draft fields, `addPlayer()`) is deleted as dead code. `renderRoster()` loses its now-unreachable non-`'te'` branch since Team 2's card was its only other caller.

**Tech Stack:** Vanilla JS single file (`app.js`), `node --test` (no framework), Prettier via `npx` (no install).

**Spec:** `docs/superpowers/specs/2026-07-18-team2-dropdown-only-design.md`

## Global Constraints

- No build step, no dependencies, no `package.json` — nothing gets installed.
- This task touches only DOM/shell code (Setup screen rendering, wiring, and `startGame`'s DOM-facing validation) — no unit tests are required or expected; this codebase deliberately leaves this to manual verification.
- After editing `app.js`/`styles.css`, run `npx prettier --write app.js styles.css` before committing.
- Run the full suite with `node --test` from the repo root; all 79 pre-existing tests must stay green (this plan adds none).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `newGame()` is NOT touched — its existing conditional-spread `oppTeam.id` handling stays exactly as-is (still correct, still covered by the existing round-trip test).
- No backward-compatibility/migration code is needed for old locally-saved freeform game data — this app has never been released (per project convention; do not add defensive normalization for this reason).
- Home/Away (`config.myTeamSide`, the toggle, the swap-home-away button) is completely unaffected — do not touch it.

---

### Task 1: Team 2 becomes a saved-team dropdown

**Files:**
- Modify: `app.js` — `findTeamByName` + `defaultDraft()` (`app.js:750-769`); `renderSetup()` (`app.js:775-863`, specifically the self-heal block at `app.js:778-785` and the Team 2 card at `app.js:818-834`); `renderRoster()` (`app.js:885-913`) and its one remaining call site (`app.js:1174` area, inside the Teams-tab editor); `wireSetup()` (`app.js:1004-1104`, specifically the `my-team-select` block at `app.js:1004-1011` which gets a Team 2 twin, the `opp-name`/`opp-add-btn`/`opp-add-num` blocks at `app.js:1036-1064`, and the `[data-rm]` block at `app.js:1092-1100`); `addPlayer()` (`app.js:1110-1116`); `startGame()` (`app.js:1294-1335`).
- Modify: `styles.css` — remove `.opp-row` / `.opp-row input` (`styles.css:175-184`).

**Interfaces:**
- Consumes: `renderActiveRosterFor(teamId, activeIds, which)` (from the prior cycle, unchanged); `state.teams`; `esc()`, `el_each()`, `commit()`/`newGame()` (unchanged).
- Produces: user-facing UI only; nothing downstream consumes new interfaces. `setupDraft.oppTeamId`/`activeOppPlayerIds` remain (same field names as before), but are now always expected to reference an existing saved team once Start is reachable.

No unit tests: this is DOM shell/render code plus `startGame`'s DOM-facing validation, which this codebase deliberately leaves to manual verification (same precedent as the rest of `wireSetup`/`renderSetup`/`startGame`).

- [ ] **Step 1: Remove `findTeamByName` and simplify `defaultDraft()`** — replace `app.js:750-769`:

```js
function findTeamByName(name) {
  const norm = name.trim().toLowerCase();
  if (!norm) return null;
  return state.teams.find((t) => t.name.trim().toLowerCase() === norm) ?? null;
}

function defaultDraft() {
  return {
    myTeamId: state.teams[0]?.id ?? null,
    activePlayerIds: state.teams[0] ? state.teams[0].players.map((p) => p.id) : [],
    oppTeamId: null,
    activeOppPlayerIds: [],
    oppName: '',
    oppPlayers: [],
    halfLengthMin: 18,
    numHalves: 2,
    otLengthMin: 4,
    myTeamSide: 'home',
  };
}
```

with:

```js
function defaultDraft() {
  const defaultOppTeam = state.teams[1] ?? state.teams[0];
  return {
    myTeamId: state.teams[0]?.id ?? null,
    activePlayerIds: state.teams[0] ? state.teams[0].players.map((p) => p.id) : [],
    oppTeamId: defaultOppTeam?.id ?? null,
    activeOppPlayerIds: defaultOppTeam ? defaultOppTeam.players.map((p) => p.id) : [],
    halfLengthMin: 18,
    numHalves: 2,
    otLengthMin: 4,
    myTeamSide: 'home',
  };
}
```

(`findTeamByName` is deleted entirely — no remaining callers after this plan. `oppName`/`oppPlayers` are dropped from the draft shape.)

- [ ] **Step 2: Simplify `renderSetup()`'s self-heal and Team 2 card** — replace the self-heal block (`app.js:778-785`):

```js
  if (!state.teams.some((t) => t.id === d.myTeamId)) {
    d.myTeamId = state.teams[0]?.id ?? null;
    d.activePlayerIds = state.teams[0] ? state.teams[0].players.map((p) => p.id) : [];
  }
  if (d.oppTeamId && !state.teams.some((t) => t.id === d.oppTeamId)) {
    d.oppTeamId = null;
    d.activeOppPlayerIds = [];
  }
```

with:

```js
  if (!state.teams.some((t) => t.id === d.myTeamId)) {
    d.myTeamId = state.teams[0]?.id ?? null;
    d.activePlayerIds = state.teams[0] ? state.teams[0].players.map((p) => p.id) : [];
  }
  if (!state.teams.some((t) => t.id === d.oppTeamId)) {
    const fallback = state.teams[1] ?? state.teams[0];
    d.oppTeamId = fallback?.id ?? null;
    d.activeOppPlayerIds = fallback ? fallback.players.map((p) => p.id) : [];
  }
```

Then replace the Team 2 card (`app.js:818-834`):

```js
    <section class="card">
      <label class="opp-row">Team 2 <input id="opp-name" list="team-names" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
      <datalist id="team-names">
        ${state.teams.map((t) => `<option value="${esc(t.name)}">`).join('')}
      </datalist>
      ${
        d.oppTeamId
          ? `<ul class="roster">${renderActiveRosterFor(d.oppTeamId, d.activeOppPlayerIds, 'opp')}</ul>`
          : `
      <div id="opp-players">${renderRoster(d.oppPlayers, 'opp')}</div>
      <div class="add-player">
        <input id="opp-add-num" type="number" inputmode="numeric" placeholder="#" class="num">
        <input id="opp-add-name" placeholder="Name (optional)">
        <button id="opp-add-btn">Add</button>
      </div>`
      }
    </section>
```

with:

```js
    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>Team 2</h2>
          <select id="opp-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.oppTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <ul class="roster">${renderActiveRosterFor(d.oppTeamId, d.activeOppPlayerIds, 'opp')}</ul>`
          : `<h2>Team 2</h2><p class="muted">Create a team on team tab.</p>`
      }
    </section>
```

- [ ] **Step 3: Add Team 2's dropdown wiring, remove the freeform wiring** — in `wireSetup()`, replace the `my-team-select` block through the end of the `[data-active-opp]` block (`app.js:1004-1035`, keep as-is) — no change needed there. Directly after it (where the `opp-name` handler currently starts, `app.js:1036`), replace everything through the `[data-rm]` block (`app.js:1036-1100`):

```js
  $('opp-name') &&
    ($('opp-name').oninput = (e) => {
      d.oppName = e.target.value;
      const match = findTeamByName(d.oppName);
      const prev = d.oppTeamId;
      if (match) {
        if (d.oppTeamId !== match.id) {
          d.oppTeamId = match.id;
          d.activeOppPlayerIds = match.players.map((p) => p.id);
        }
      } else if (d.oppTeamId !== null) {
        d.oppTeamId = null;
        d.activeOppPlayerIds = [];
        d.oppPlayers = [];
      }
      if (d.oppTeamId !== prev) {
        renderSetup();
        const inp = $('opp-name');
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
    });

  $('opp-add-btn') &&
    ($('opp-add-btn').onclick = () => addPlayer($('opp-add-num'), $('opp-add-name')));
  $('opp-add-num') &&
    ($('opp-add-num').onkeydown = (e) => {
      if (e.key === 'Enter') $('opp-add-btn').click();
    });

  for (const len of ['half-len', 'num-halves', 'ot-len']) {
    const map = { 'half-len': 'halfLengthMin', 'num-halves': 'numHalves', 'ot-len': 'otLengthMin' };
    $(len) &&
      ($(len).oninput = (e) => {
        d[map[len]] = parseInt(e.target.value, 10) || d[map[len]];
      });
  }

  el_each(
    '[data-side]',
    (b) =>
      (b.onclick = () => {
        d.myTeamSide = b.dataset.side;
        renderSetup();
      }),
  );
  el_each(
    '[data-theme-set]',
    (b) =>
      (b.onclick = () => {
        state.theme = b.dataset.themeSet;
        saveTheme();
        applyTheme();
        renderSetup();
      }),
  );
  el_each(
    '[data-rm]',
    (b) =>
      (b.onclick = () => {
        const [, i] = b.dataset.rm.split(':');
        d.oppPlayers.splice(parseInt(i, 10), 1);
        renderSetup();
      }),
  );
```

with:

```js
  const oppSel = $('opp-team-select');
  if (oppSel)
    oppSel.onchange = () => {
      d.oppTeamId = oppSel.value;
      const t = state.teams.find((x) => x.id === oppSel.value);
      d.activeOppPlayerIds = t ? t.players.map((p) => p.id) : [];
      renderSetup();
    };

  for (const len of ['half-len', 'num-halves', 'ot-len']) {
    const map = { 'half-len': 'halfLengthMin', 'num-halves': 'numHalves', 'ot-len': 'otLengthMin' };
    $(len) &&
      ($(len).oninput = (e) => {
        d[map[len]] = parseInt(e.target.value, 10) || d[map[len]];
      });
  }

  el_each(
    '[data-side]',
    (b) =>
      (b.onclick = () => {
        d.myTeamSide = b.dataset.side;
        renderSetup();
      }),
  );
  el_each(
    '[data-theme-set]',
    (b) =>
      (b.onclick = () => {
        state.theme = b.dataset.themeSet;
        saveTheme();
        applyTheme();
        renderSetup();
      }),
  );
```

(The `[data-rm]` block is dropped entirely — it only ever handled the freeform opponent roster's removal buttons. The Teams-tab editor's own roster deletion is wired separately and is untouched by this change.)

- [ ] **Step 4: Delete `addPlayer()`** — remove the whole function from `app.js:1110-1116`:

```js
function addPlayer(numEl, nameEl) {
  const num = parseInt(numEl.value, 10);
  if (isNaN(num)) return;
  setupDraft.oppPlayers.push({ id: makeLocalId(), num, name: nameEl.value.trim() });
  renderSetup();
  document.getElementById('opp-add-num').focus();
}
```

No remaining callers after Step 3.

- [ ] **Step 5: Simplify `renderRoster()`** — its only remaining caller passes `which === 'te'` (the Teams-tab editor). Replace `app.js:885-913`:

```js
function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">Add players</p>`;
  if (which === 'te') {
    return (
      `<ul class="list">` +
      players
        .map(
          (p, i) => `
        <li class="listrow">
          <span class="listmain">#${p.num} ${esc(p.name || '')}</span>
          <button data-editbtn="${which}:${i}">Edit</button>
          <button data-rm="${which}:${i}" class="danger">Delete</button>
        </li>`,
        )
        .join('') +
      `</ul>`
    );
  }
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

with:

```js
function renderRoster(players) {
  if (!players.length) return `<p class="muted">Add players</p>`;
  return (
    `<ul class="list">` +
    players
      .map(
        (p, i) => `
        <li class="listrow">
          <span class="listmain">#${p.num} ${esc(p.name || '')}</span>
          <button data-editbtn="te:${i}">Edit</button>
          <button data-rm="te:${i}" class="danger">Delete</button>
        </li>`,
      )
      .join('') +
    `</ul>`
  );
}
```

Then find `renderRoster`'s one remaining call site (search for `renderRoster(d.players, 'te')`, near `app.js:1174` in the Teams-tab editor) and change it to `renderRoster(d.players)` (drop the now-removed second argument).

- [ ] **Step 6: Simplify `startGame()`** — replace `app.js:1294-1335`:

```js
function startGame(tipWinner, startClock = true) {
  const d = setupDraft;
  const err = document.getElementById('setup-error');
  const myTeam = state.teams.find((t) => t.id === d.myTeamId);
  if (!myTeam) {
    err.textContent = 'Select a team from the Teams tab first.';
    return;
  }
  if (!d.oppName.trim()) {
    err.textContent = "Enter Team 2's name.";
    return;
  }
  const activePlayers = myTeam.players.filter((p) => d.activePlayerIds.includes(p.id));
  if (!activePlayers.length) {
    err.textContent = 'Select at least one active player.';
    return;
  }

  let oppTeamId, oppPlayers;
  const oppSaved = d.oppTeamId ? state.teams.find((t) => t.id === d.oppTeamId) : null;
  if (oppSaved) {
    oppPlayers = oppSaved.players.filter((p) => d.activeOppPlayerIds.includes(p.id));
    if (!oppPlayers.length) {
      err.textContent = 'Select at least one active player for Team 2.';
      return;
    }
    oppTeamId = oppSaved.id;
  } else {
    oppPlayers = d.oppPlayers;
    oppTeamId = undefined;
  }

  let g = newGame({
    config: {
      halfLengthMin: d.halfLengthMin,
      numHalves: d.numHalves,
      otLengthMin: d.otLengthMin,
      myTeamSide: d.myTeamSide,
    },
    myTeam: { id: myTeam.id, name: myTeam.name, players: activePlayers },
    oppTeam: { id: oppTeamId, name: d.oppName.trim(), players: oppPlayers },
  });
  g.id = makeLocalId();
  g.date = Date.now();
  g = setPossession(g, tipWinner);
  if (startClock) g = toggleClock(g, Date.now()); // tip-off starts the clock (Start button leaves it stopped)
  state.game = g;
  setupDraft = null;
  addOpen = null;
  missArm = false;
  missLock = false;
  saveGame();
  render();
}
```

with:

```js
function startGame(tipWinner, startClock = true) {
  const d = setupDraft;
  const err = document.getElementById('setup-error');
  const myTeam = state.teams.find((t) => t.id === d.myTeamId);
  if (!myTeam) {
    err.textContent = 'Select a team from the Teams tab first.';
    return;
  }
  const activePlayers = myTeam.players.filter((p) => d.activePlayerIds.includes(p.id));
  if (!activePlayers.length) {
    err.textContent = 'Select at least one active player.';
    return;
  }

  const oppTeam = state.teams.find((t) => t.id === d.oppTeamId);
  if (!oppTeam) {
    err.textContent = 'Select a second team from the Teams tab first.';
    return;
  }
  const activeOppPlayers = oppTeam.players.filter((p) => d.activeOppPlayerIds.includes(p.id));
  if (!activeOppPlayers.length) {
    err.textContent = 'Select at least one active player for Team 2.';
    return;
  }

  let g = newGame({
    config: {
      halfLengthMin: d.halfLengthMin,
      numHalves: d.numHalves,
      otLengthMin: d.otLengthMin,
      myTeamSide: d.myTeamSide,
    },
    myTeam: { id: myTeam.id, name: myTeam.name, players: activePlayers },
    oppTeam: { id: oppTeam.id, name: oppTeam.name, players: activeOppPlayers },
  });
  g.id = makeLocalId();
  g.date = Date.now();
  g = setPossession(g, tipWinner);
  if (startClock) g = toggleClock(g, Date.now()); // tip-off starts the clock (Start button leaves it stopped)
  state.game = g;
  setupDraft = null;
  addOpen = null;
  missArm = false;
  missLock = false;
  saveGame();
  render();
}
```

- [ ] **Step 7: Remove the dead `.opp-row` CSS** — in `styles.css`, delete `styles.css:175-184`:

```css
.opp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.opp-row input {
  width: auto;
  flex: 1;
}
```

(`.add-player` and `.add-player button` stay — still used by the Teams-tab editor's own add-player form.)

- [ ] **Step 8: Run the full test suite to verify nothing regressed**

Run: `node --test` → 79 pass (this task adds no unit tests; it must not break any existing ones).

- [ ] **Step 9: Manual verification** (in a browser: `python -m http.server`, open `index.html`, or open the file directly)

1. On Setup, confirm Team 2 shows a dropdown + checkbox roster, matching Team 1's look — no text box, no autocomplete, no add-player form.
2. With 2+ saved teams, confirm Team 2 defaults to a different team than Team 1's initial selection.
3. Change Team 2's dropdown — confirm its roster checkboxes update to the newly selected team's players (all checked by default).
4. Uncheck a Team 2 player, Start the game — confirm only active players appear for Team 2 in-game.
5. With only 1 saved team total, confirm both Team 1 and Team 2 offer that same team (no crash).
6. With 0 saved teams, confirm both cards show "Create a team on team tab." and Start is blocked with a clear error.
7. Start a game, add a player mid-game to Team 2 via the Activity dialog — confirm it still writes back to that saved team (Teams tab reflects the addition).
8. Confirm the Home/Away toggle and the swap-home-away button on the live game screen are unaffected.
9. On the Teams tab, confirm editing a team's roster (add/edit/delete a player) still works exactly as before — this exercises `renderRoster`'s simplified form.

- [ ] **Step 10: Format and commit**

```bash
npx prettier --write app.js styles.css
node --test
git add app.js styles.css
git commit -m "Make Team 2 a saved-team dropdown, matching Team 1

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual verification (user, after the task)

Repeat Step 9's checks end-to-end in one sitting, on your actual device if possible — this removes the freeform-opponent path entirely, so it's worth confirming nothing from the prior cycle's manual verification (mid-game write-back, active-player filtering) regressed.
