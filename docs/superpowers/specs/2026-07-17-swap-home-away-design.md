# Swap Home/Away on the Live Game Screen

## Problem

Once a game is started, which team displays on the left vs. right (`myTeamSide`,
set at Setup) is fixed for the rest of the game. If the user picked the wrong
side, or home/away changes at the scorer's table after tip-off, there's no way
to fix it without abandoning and restarting the game.

## Goal

A small button next to the left team's name on the live game screen that swaps
which team is displayed on the left vs. right. The swap is a single global
action (not per-team), undoable, and logged like every other mutating game
action in this app.

## Why this is a small change

`g.config.myTeamSide` (`'home'` | `'away'`) is *only* used to derive
`leftTeam`/`rightTeam` for display, in both `renderGame` and `renderSummary`.
Every other piece of game state — score, team fouls, timeouts, possession,
player columns, box score — is keyed by `'my'`/`'opp'`, never by
`'home'`/`'away'`. So flipping this one field is sufficient; nothing else
needs to move, and nothing else needs to be touched to make the whole screen
(scores, fouls, timeouts, possession arrow, player columns) reflect the swap.

## Logic: `swapHomeAway`

New pure function in `app.js`, placed next to `togglePossession` and following
its exact pattern (single-field toggle, `prev` captured for `undo`):

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

`undo()` gets a matching branch in its `rev.kind` dispatch:

```js
} else if (rev.kind === 'swaphomeaway') {
  g.config.myTeamSide = rev.prev;
}
```

This makes the swap show up as a "Home/Away swapped" line in the game log, and
pressing UNDO restores the exact prior side — consistent with how
`togglePossession` (and every other mutating action) is undone.

## UI

**Placement.** The button attaches only to the *left* team's `.tn` (team-name)
element in the game-screen header. Because the swap is one global action, this
keeps it in a fixed visual position (top-left of the game screen) regardless
of which team currently occupies that box:

```html
<div class="tn">${esc(teamName(g, leftTeam))} <button id="btn-swap-sides" class="swapbtn" title="Swap Home/Away">⇄</button></div>
```

**Icon/style.** A small, unlabeled icon button using the `⇄` glyph, matching
this app's existing convention of plain unicode glyphs for icons (`◀`/`▶` for
possession, `×` for remove). The `.gh` header bar deliberately hardcodes
`background:#111; color:#fff` to force a dark "scoreboard" look in both app
themes (existing code comment: "stays dark in both themes"). The new button
follows that same intentional exception rather than introducing a new color —
transparent background, no border, `color: inherit` — so it automatically
matches the header's white text in both light and dark themes without adding
a new hardcoded value:

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

**Wiring.** In `wireGame()`, alongside the existing `$('poss')`/`$('clk-toggle')`
handlers:

```js
$('btn-swap-sides') &&
  ($('btn-swap-sides').onclick = () => commit((game, now) => swapHomeAway(game, now)));
```

`commit()` saves and re-renders as usual, so the swapped layout, new log
entry, and enabled UNDO button all update together in one render pass.

## Testing

`swapHomeAway` is a pure function, tested the same way as `togglePossession`
in `logic.test.js` (added to the `module.exports` shim):

- Toggles `config.myTeamSide` `'home'` → `'away'` and back.
- Pushes a log entry with `type: 'swap_sides'` and the correct `rev`.
- `undo()` after a swap restores the exact prior `myTeamSide`.
- Sequential swap + swap-back leaves `myTeamSide` unchanged, and both log
  entries are poppable via undo (mirrors the existing "sequential undo peels
  actions in reverse" test style).

The button itself — DOM wiring, and that the `⇄` glyph renders next to the
correct (left) team name after a swap — is manually verified, matching this
codebase's convention for shell/DOM code.

Manual verification (user):
1. Start a game, note which team is on the left, tap the swap button — teams,
   scores, fouls, timeouts, and player columns should all flip sides; the
   possession arrow (`◀`/`▶`) should still point at whichever team currently
   has possession.
2. Tap UNDO — everything flips back, and the "Home/Away swapped" log entry is
   removed.
3. Swap, then check the Final summary screen after ending the game — it
   should reflect the last swap state (since it derives from the same
   `config.myTeamSide`).

## Out of scope (YAGNI)

No swap button on the summary screen (the game is over; the final side order
is just an artifact of how it ended). No confirmation dialog (cheap, undoable
toggle — same tier as the possession toggle).
