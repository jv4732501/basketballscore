# Center Button Click Flash

## Problem

The center-column stat buttons (2PT, 3PT, FT, MISS, OREB, DREB, STL, BLK, AST, TOVR, FOUL, UNDO — rendered by `renderControls` in `app.js`) give no immediate visual acknowledgment when tapped. Add a brief blue flash animation, lasting 500ms, to confirm the tap registered.

## Scope

- All 12 buttons in the `.grid` inside `.controls` (the center column between the two player lists).
- Animation: background instantly turns blue, then fades back to the button's normal background over 500ms.
- Applies only to genuine short clicks. Long-press (which opens the modifier popover for shot/foul buttons) must not trigger the flash.
- Out of scope: player-list buttons (`.pl`), score/foul/timeout adjust buttons (`.adj`, `.tfadj`), clock controls, nav tabs, popover menu items.

## Constraint driving the design

Clicking any grid button runs `commit()` → `render()` synchronously, which rebuilds the entire `#game` section's `innerHTML` (see `renderGame`, `app.js`). The clicked `<button>` DOM node is destroyed and replaced immediately as part of handling its own click. This rules out:

- CSS `:active` — state is tied to press duration, not a fixed 500ms, and the node is replaced before/around the state change.
- JS-added class + `setTimeout` removal — the node the timeout would act on no longer exists after the click's own render pass.

## Approach

Track which button was just clicked in module-level state, and have the render function apply a one-shot `flash` class to that button's freshly created element. A CSS `@keyframes` animation on that class auto-plays whenever the class is present on an element at the moment it's inserted into the DOM — no timers needed to add or remove anything.

### `app.js` changes

- Add `let flashKey = null;` alongside the existing `missArm` module state (near line 475).
- In `attachPressHandlers`'s `onclick` (~line 1118): set `flashKey = stat` immediately before calling `recordSelectedStat`, but only in the branches where a player is actually selected (mirrors `recordSelectedStat`'s own `if (!team) return;` guard) — otherwise no render follows and a stale `flashKey` could incorrectly flash an unrelated button on some later, unrelated render.
- In the `btn-miss` onclick (~line 1066): set `flashKey = 'btn-miss'` before toggling `missArm` and calling `render()`. This handler always re-renders, so no guard needed.
- In the `btn-undo` onclick (~line 1067): set `flashKey = 'btn-undo'` before calling `commit(...)`. Always re-renders, no guard needed.
- In `renderControls` (~line 1003): add a helper, e.g. `const flashClass = (key) => { if (flashKey === key) { flashKey = null; return ' flash'; } return ''; };`, and apply it to each of the 12 buttons' `class` attributes using their `data-stat` value (`2pt`, `3pt`, `ft`, `oreb`, `dreb`, `stl`, `blk`, `ast`, `to`, `foul`) or id (`btn-miss`, `btn-undo`) as the key.

Clearing `flashKey` at the moment it's matched (rather than via a timer) guarantees it fires at most once per click, even though `renderControls` may be invoked again later for unrelated state changes (e.g. clicking a score adjust button also rebuilds the whole game section).

### `styles.css` changes

Add near the existing `.grid button` rule (~line 81):

```css
@keyframes flashBlue { 0% { background:#3b82f6; } 100% { background:var(--btn-bg); } }
.grid button.flash { animation: flashBlue 500ms ease-out; }
```

No fill-mode is set, so once the animation completes, the button's background falls back to whatever the normal cascade dictates (e.g. `#btn-miss.armed`'s red stays red after its own flash finishes).

## Testing

Pure visual polish on top of existing module-level UI flags (same pattern as `missArm`) — no game-logic changes, so no new unit tests in `logic.test.js`. Verify manually in the browser:

1. Click several different grid buttons (with a player selected) and confirm each flashes blue and fades over ~500ms.
2. Confirm long-pressing a shot/foul button to open its modifier popover does not trigger the flash.
3. Confirm rapidly clicking different buttons in succession never flashes the wrong button.
4. Confirm clicking a grid button with no player selected (a no-op) does not leave a stale flash that appears on a later, unrelated click.
