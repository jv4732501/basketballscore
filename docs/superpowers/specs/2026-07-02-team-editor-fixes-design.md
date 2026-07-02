# Team Editor Roster Fixes: Reliable Edit Trigger, Edit Icon, Focus-Ring Clipping, Delete Confirmation

## Problem

Four related issues on the Team Editor screen ("Edit Team", reached from the Teams tab), found and requested while following up on the just-shipped player-edit-dialog feature (Cycle 21):

1. **Double-click doesn't reliably open the edit dialog.** The Team Editor's `.editpl` span uses the native browser `dblclick` event. Native `dblclick` is unreliable — often simply never fires — for touch double-taps on many mobile browsers. Every other gesture in this app (long-press, the in-game double-click) is built from `touchstart`/`touchend`/`click` timing rather than a native browser gesture event; the Team Editor is the one place that broke that pattern, which is why it doesn't work while the in-game version does.
2. **No visible/discoverable way to edit a player** other than the (broken) double-click — a small pencil icon button, always visible next to the existing remove (`×`) button, would fix discoverability regardless of the double-click issue.
3. **The focus ring on the edit dialog's input fields gets clipped.** `.dlgbody` sets `overflow-y: auto` (needed for the Activity dialog's scrollable log) with no explicit `overflow-x`; per CSS rules, setting only one overflow axis forces the browser to compute the other as non-visible too. The inputs are `width: 100%` flush against `.dlgbody`'s edge, so the browser's default focus ring (rendered a couple pixels outside the input's border) gets clipped at that boundary.
4. **Removing a player from the Team Editor's roster has no confirmation**, unlike removing a whole team (which already shows `Delete team "..."? This cannot be undone.`).

## Scope

- `app.js`:
  - Replace the `.editpl` `dblclick` listener with the same deferred single-click-timer pattern already used for the in-game double-click (`attachPlayerPress`'s `onclick`), adapted for the case where a single click has no competing action (it's simply a no-op if no second click follows).
  - `renderRoster`: add a new `<button class="editbtn" data-editbtn="te:i">✎</button>` immediately before the existing `<button data-rm>` — only when `which === 'te'` (same condition as `.editpl`).
  - `renderTeamEditor`: wire `[data-editbtn]` with a plain single `onclick` calling `openRosterEditDialog(i)` directly (no gesture detection needed — it's an explicit button).
  - `renderTeamEditor`'s existing `[data-rm]` handler: add a `confirm(...)` prompt before splicing the player out, matching the existing "Delete team" confirmation's style and only for this ("te") roster — the Setup screen's separate `[data-rm]` handler (in `wireSetup()`) is untouched.
- `styles.css`:
  - `.dlgbody`: add `padding: 3px;` so the focus ring has room to render.
  - New `.editbtn` rule, styled like `.rm` (no border/background, larger font-size) but colored `var(--muted)` instead of `var(--danger)`, since editing isn't destructive.
- Out of scope: the Setup screen's roster (`which` = `'my'`/`'opp'`) gets no new confirmation, no edit icon, no double-click fix — none of these four issues apply there since it never had the `.editpl`/edit-dialog feature to begin with.

## Approach

### 1. Reliable click-vs-double-click for `.editpl`

Current wiring (`renderTeamEditor`):
```js
el_each('[data-editpl]', (b) =>
  b.addEventListener('dblclick', () => {
    const [, i] = b.dataset.editpl.split(':'); // "te:i"
    openRosterEditDialog(parseInt(i, 10));
  }),
);
```

Becomes:
```js
el_each('[data-editpl]', (b) => {
  let clickTimer = null;
  b.addEventListener('click', () => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      const [, i] = b.dataset.editpl.split(':'); // "te:i"
      openRosterEditDialog(parseInt(i, 10));
      return;
    }
    clickTimer = setTimeout(() => {
      clickTimer = null;
    }, 300);
  });
});
```

A lone click starts a 300ms timer that, if nothing follows, simply clears itself — no action (there is no single-click behavior for this element, unlike in-game player selection). A second click within the window cancels that timer and opens the dialog. This is the same "defer to disambiguate" technique already used for the MISS lock feature and the in-game player edit dialog, just without a single-click action to perform when the timer expires.

### 2. Edit icon button

Current (`renderRoster`, the `'te'` branch):
```js
which === 'te'
  ? `<span class="editpl" data-editpl="${which}:${i}">#${p.num} ${esc(p.name || '')}</span>`
  : `#${p.num} ${esc(p.name || '')}`
```

Becomes:
```js
which === 'te'
  ? `<span class="editpl" data-editpl="${which}:${i}">#${p.num} ${esc(p.name || '')}</span><button data-editbtn="${which}:${i}" class="editbtn">✎</button>`
  : `#${p.num} ${esc(p.name || '')}`
```

The new button sits between the `.editpl` span and the existing `<button data-rm>` (which is appended outside this ternary, unconditionally) — so the row reads: player text, pencil icon, `×`. New wiring in `renderTeamEditor`:
```js
el_each('[data-editbtn]', (b) =>
  (b.onclick = () => {
    const [, i] = b.dataset.editbtn.split(':'); // "te:i"
    openRosterEditDialog(parseInt(i, 10));
  }),
);
```

### 3. Focus-ring clipping fix

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

### 4. Delete confirmation

Current (`renderTeamEditor`):
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

Becomes:
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

Matches the existing "Delete team" confirmation's style (a plain `confirm()` call, same file). The Setup screen's separate `[data-rm]` handler (`wireSetup()`) is a different code block entirely and is not touched.

### `.editbtn` CSS

```css
.editbtn {
  border: none;
  background: none;
  color: var(--muted);
  font-size: 1.1rem;
}
```

Mirrors `.rm`'s exact structure (no border/background, same font-size) but uses `var(--muted)` instead of `var(--danger)`, since this action isn't destructive.

## Testing

All four changes are pure UI-interaction/markup/CSS — no pure-function logic changes, so no automated test coverage applies (matches the precedent set throughout this app's interaction code, e.g. the existing Activity dialog and MISS lock feature). Manual verification (deferred to the user, since this sandbox has no browser):

1. Double-clicking a player row in the Team Editor now reliably opens the Edit Player dialog (works the same way the in-game version already does).
2. A single click on a player row does nothing (no-op), same as before.
3. A pencil icon now appears between each player's text and the `×` button; tapping it opens the same Edit Player dialog.
4. Clicking into either input field in the Edit Player dialog shows a complete, unclipped focus ring.
5. Tapping `×` on a player in the Team Editor now shows a confirmation ("Remove #N Name from the roster?") before removing them; Cancel leaves the roster unchanged.
6. The Setup screen's roster removal (before starting a game) is unaffected — no confirmation, no edit icon, no double-click behavior there.
7. The existing "Delete team" confirmation and the overall Team Editor Save/Cancel flow are unaffected.
