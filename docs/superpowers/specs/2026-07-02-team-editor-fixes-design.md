# Team Editor Roster Consistency + Fixes

## Problem

Follow-up on the just-shipped player-edit-dialog feature (Cycle 21), covering four issues on the Team Editor screen ("Edit Team", reached from the Teams tab):

1. **Visual inconsistency.** The Team Editor's roster rows use a cramped `<li>#num name<button class="rm">×</button></li>` layout — the only list in the app still styled this way. Both the Teams tab's own team list and the History tab's game list already use a shared `.listrow`/`.listmain` pattern with full labeled buttons ("Edit"/"Delete", "Open"/"Delete"). The roster should match.
2. **Double-click to edit doesn't reliably work.** It's built on the native `dblclick` DOM event, which is unreliable — often simply never fires — for touch double-taps on many mobile browsers. Every other gesture in this app (long-press, in-game double-click) is built from `touchstart`/`touchend`/`click` timing instead. Since the redesign in point 1 adds a full labeled "Edit" button, double-click is no longer needed as a trigger and is removed entirely, along with its unreliable `dblclick` wiring — this eliminates the bug rather than patching it.
3. **The edit dialog's input focus ring gets clipped.** `.dlgbody` sets `overflow-y: auto` (needed for the Activity dialog's scrollable log) with no explicit `overflow-x`; per CSS rules, setting only one overflow axis forces the browser to compute the other as non-visible too. The inputs are `width: 100%` flush against `.dlgbody`'s edge, so the browser's default focus ring (rendered a couple pixels outside the input's border) gets clipped at that boundary.
4. **No confirmation before removing a player** from the Team Editor's roster, unlike removing a whole team (already shows `Delete team "..."? This cannot be undone.`).

## Scope

- `app.js`:
  - `renderRoster`: for `which === 'te'` only, render `<ul class="list">` of `<li class="listrow">` rows — `<span class="listmain">#num name</span>`, a plain `<button data-editbtn="te:i">Edit</button>`, and `<button data-rm="te:i" class="danger">Delete</button>`. The `which === 'my'`/`'opp'` branch (Setup screen roster previews) is completely unchanged — same markup as before.
  - `renderTeamEditor`: remove the `[data-editpl]`/`dblclick` wiring entirely. Add `el_each('[data-editbtn]', ...)` (plain `onclick` → `openRosterEditDialog(i)`). Add a `confirm(...)` prompt to the existing `[data-rm]` handler before splicing the player out.
- `styles.css`:
  - Remove the now-unused `.editpl` rule.
  - Add `padding: 3px;` to `.dlgbody` so the focus ring has room to render.
  - **No new button-styling CSS needed** — `.list`, `.listrow`, `.listmain`, `.listrow button`, and `.listrow button.danger` already exist (used by the Teams tab's team list and the History tab's game list) and are reused verbatim.
- Out of scope: the Setup screen's roster (`which` = `'my'`/`'opp'`) is untouched — no edit button, no confirmation, no styling change. `openRosterEditDialog` itself is unchanged (it already operates on `teamEdit.players[i]` regardless of how the trigger UI looks).

## Approach

### 1 & 2. Roster row redesign (`renderRoster`), double-click removed

Current:
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

Becomes:
```js
function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">No players yet</p>`;
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

The `which === 'my'`/`'opp'` path (used only by the Setup screen) is byte-identical to the original function's only branch — nothing changes there.

In `renderTeamEditor`, remove this block entirely:
```js
el_each('[data-editpl]', (b) =>
  b.addEventListener('dblclick', () => {
    const [, i] = b.dataset.editpl.split(':'); // "te:i"
    openRosterEditDialog(parseInt(i, 10));
  }),
);
```

### 3. Wiring for the new Edit/Delete buttons

Current `[data-rm]` handler in `renderTeamEditor`:
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

Becomes (adds the confirmation):
```js
el_each(
  '[data-rm]',
  (b) =>
    (b.onclick = () => {
      const [, i] = b.dataset.rm.split(':'); // "te:i"
      const p = d.players[parseInt(i, 10)];
      if (!confirm(`Remove #${p.num}${p.name ? ' ' + p.name : ''} from the roster?`)) return;
      d.players.splice(parseInt(i, 10), 1);
      renderTeams();
    }),
);
```

New, added immediately after it:
```js
el_each('[data-editbtn]', (b) =>
  (b.onclick = () => {
    const [, i] = b.dataset.editbtn.split(':'); // "te:i"
    openRosterEditDialog(parseInt(i, 10));
  }),
);
```

### 4. Focus-ring clipping fix

Current:
```css
.dlgbody {
  overflow-y: auto;
  font-size: 0.85rem;
}
```

Becomes:
```css
.dlgbody {
  overflow-y: auto;
  font-size: 0.85rem;
  padding: 3px;
}
```

### CSS cleanup

Remove the now-unused rule (added in Cycle 21, no longer referenced by any markup after this change):
```css
.editpl {
  cursor: pointer;
}
```

## Testing

All changes are pure UI-interaction/markup/CSS — no pure-function logic changes, so no automated test coverage applies (matches the precedent set throughout this app's interaction code). Manual verification (deferred to the user, since this sandbox has no browser):

1. The Team Editor's roster rows now look like the Teams tab's team list and the History tab's game list — a card-style row with the player's `#num name` on the left and "Edit"/"Delete" buttons on the right (Delete in red).
2. Tapping "Edit" opens the Edit Player dialog, pre-filled, exactly as before.
3. Double-clicking the player text no longer does anything (removed) — this is expected, not a regression, since "Edit" now covers that.
4. Tapping "Delete" shows a confirmation ("Remove #N Name from the roster?"); confirming removes the player, Cancel leaves the roster unchanged.
5. Clicking into either input field in the Edit Player dialog shows a complete, unclipped focus ring.
6. The Setup screen's roster (before starting a game) is completely unaffected — same compact `#num name ×` style, no Edit button, no confirmation.
7. The overall Team Editor Save/Cancel flow, and the Teams tab's own "Delete team" confirmation, are unaffected.
