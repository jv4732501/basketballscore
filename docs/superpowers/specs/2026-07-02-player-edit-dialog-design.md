# Edit Player (Number/Name) — In-Game and Team Editor

## Problem

There is currently no way anywhere in the app to change an existing player's jersey number or name — the Team Editor only supports adding new players or removing existing ones (renaming requires delete + re-add). This adds two entry points for the same underlying edit: double-clicking a player during a live game, and double-clicking a player row in the Team Editor ("Edit Team" screen, reached from the Teams tab).

## Scope

- `app.js`:
  - New pure function `editPlayer(game, team, id, { num, name })`, mirroring `addPlayerToGame`'s shape.
  - `attachPlayerPress` gains click-vs-double-click disambiguation (mirroring the MISS button's Cycle 15 pattern) so a plain tap still selects the player (after a short ~300ms delay to allow detecting a second click) and a double-click opens `openPlayerEditDialog(team, id)`.
  - `openPlayerEditDialog(team, id)`: a new dialog (reusing the existing `.dialog`/`.dlgback` component and `closeActivityDialog()` to close) with number/name inputs. On Save, commits `editPlayer` through the normal game-state path; if `team === 'my'`, also updates the matching player in the saved `state.teams` roster and calls `saveTeams()` (mirroring `addGamePlayerFromForm`'s existing my-team-only sync). Opponent edits are game-only, matching how opponent players are never persisted anywhere today.
  - `renderRoster(players, which)`: when `which === 'te'` only, wrap each row's `#num name` text in `<span class="editpl" data-editpl="te:i">` — the Setup screen's roster previews (`which` = `'my'`/`'opp'`) are unchanged.
  - `renderTeamEditor`: wires `[data-editpl]` with a native `dblclick` listener (no deferred-timer trick needed here — these rows have no existing single-click action to disambiguate against) calling a new `openRosterEditDialog(i)`.
  - `openRosterEditDialog(i)`: a separate dialog function (not a reuse of `openPlayerEditDialog`, since it operates on the in-memory `teamEdit` draft rather than a live game) — same visual shape (number/name inputs, inline error), but on Save it mutates `teamEdit.players[i]` directly and calls `renderTeams()`. No `commit()`, no immediate `saveTeams()` — consistent with how removing a player from this same screen today doesn't persist until the editor's own "Save" button is tapped.
- `styles.css`: `.dialog input` and `.dialog label` (new rules, reusing `.card input`/`.card label`'s exact values — dialogs don't currently contain form inputs), and `.editpl { cursor: pointer; }` as a small affordance hint on the Team Editor's now-interactive row text.
- Out of scope: no delete-player affordance added to either dialog; no edit capability added to the Setup screen's roster previews (`which` = `'my'`/`'opp'`); `editPlayer` doesn't touch any stat fields, only `num`/`name`.

## Approach

### `editPlayer` (pure function)

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

Added to the test-runner export shim alongside `addPlayerToGame`. Given this is testable pure logic (like `addPlayerToGame`, which has unit test coverage), unit tests are added for it: editing an existing player's num/name for both `my` and `opp` teams, and a no-op-return for an unknown id (mirroring `addPlayerToGame`'s existing test shape).

### In-game click-vs-double-click (`attachPlayerPress`)

Current `onclick`:
```js
btn.onclick = () => {
  if (longFired) {
    longFired = false;
    return;
  }
  state.game.selectedPlayerId = state.game.selectedPlayerId === id ? null : id;
  saveGame();
  render();
};
```

Becomes (new `clickTimer` local variable added alongside the existing `timer`/`longFired`):
```js
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
```

This is the same "defer the single-click action briefly, cancel-and-branch on a second click within the window" technique already used for the MISS button's lock feature — a plain tap now takes effect ~300ms after release instead of instantly, the same one-time latency tradeoff already accepted there.

### `openPlayerEditDialog(team, id)` (in-game)

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
```

### `renderRoster` (`which === 'te'` only) and `openRosterEditDialog(i)` (Team Editor)

Current:
```js
(p, i) =>
  `<li>#${p.num} ${esc(p.name || '')}<button data-rm="${which}:${i}" class="rm">×</button></li>`,
```

Becomes:
```js
(p, i) =>
  `<li>${
    which === 'te'
      ? `<span class="editpl" data-editpl="${which}:${i}">#${p.num} ${esc(p.name || '')}</span>`
      : `#${p.num} ${esc(p.name || '')}`
  }<button data-rm="${which}:${i}" class="rm">×</button></li>`,
```

`renderTeamEditor` gains (alongside its existing `[data-rm]` wiring):
```js
el_each('[data-editpl]', (b) =>
  b.addEventListener('dblclick', () => {
    const [, i] = b.dataset.editpl.split(':');
    openRosterEditDialog(parseInt(i, 10));
  }),
);
```

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

### CSS

New rules (dialogs don't currently contain form inputs, so there's nothing existing to extend):
```css
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
.editpl {
  cursor: pointer;
}
```

## Testing

`editPlayer` is pure game logic (like `addPlayerToGame`), so it gets unit tests in `logic.test.js`: editing an existing player's num/name for `my` and for `opp`, and confirming an unknown id is a no-op (returns the same game unchanged).

The dialog/wiring code itself (both `openPlayerEditDialog` and `openRosterEditDialog`, plus the `attachPlayerPress` click-vs-double-click change) has no automated test coverage — matches the precedent set by the existing player Activity dialog and the MISS lock feature, neither of which have UI-level tests. Manual verification (deferred to the user, since this sandbox has no browser):

1. In a live game, a single tap on a player still selects them (after a brief delay) exactly as before.
2. Double-clicking a player (either team) opens an Edit Player dialog pre-filled with their current number/name.
3. Saving a valid number/name updates the player immediately in the game; for my team, it's also reflected next time you edit that team from the Teams tab.
4. Saving with a blank/invalid number shows an inline error and does not close the dialog.
5. Cancel closes the dialog with no changes.
6. In the Team Editor (Teams tab → edit a team), double-clicking a player row opens the same-shaped dialog; Save updates the row immediately in the editor, but the overall team isn't persisted until the editor's own Save button is tapped (matching how removing a player already behaves).
7. The Setup screen's roster previews (before starting a game) are unaffected — no double-click behavior there.
8. The existing long-press (Activity/Sub In-Out) and normal Activity dialog flows are unaffected.
