# MISS Button Double-Click Lock

## Problem

The MISS button currently supports only a one-shot arm: a single click toggles `missArm`, and the moment a shot is recorded while armed, it auto-disarms (`attachPressHandlers`'s `onclick`, `app.js`). Recording several consecutive misses (e.g. a cold-shooting stretch) requires re-clicking MISS before every single shot. This adds a double-click gesture that arms MISS in a "sticky" mode — it stays armed across multiple shots until double-clicked again — without changing the existing single-click one-shot behavior.

## Scope

- `app.js`: add a `missLock` module-level state variable; change the MISS click handler to distinguish single- vs. double-click; change the shot-recording check in `attachPressHandlers` to also honor `missLock`; reset `missLock` alongside the existing `missArm` resets (game start, discard/new game); update `renderControls`'s MISS button markup to add a `locked` class.
- `styles.css`: add one new rule, `#btn-miss.locked { border-color: var(--accent); }`.
- Out of scope: no other button gains double-click behavior; no change to the existing single-click one-shot arm/disarm behavior when not locked; no change to `undo` (locked state is not undo-tracked, consistent with how the existing one-shot `missArm` is already excluded from undo).

## Approach

### State

Add `let missLock = false;` next to the existing `let missArm = false;` (both near the other module-level game-screen state, `app.js` around line 618). Reset it to `false` at the same two places `missArm` is already reset to `false`: game start (`startGame`, line ~1011) and discard/new-game (`discardGame`/`newGameFromSummary` path, line ~1060).

### Click handling: distinguishing single vs. double click

Native `click` and `dblclick` events both fire on a double-click (`click`, `click`, then `dblclick`), so an undebounced `onclick` would toggle `missArm` twice before any `dblclick` handler ran, leaving state in an unpredictable combination. Instead, the MISS click handler defers its single-click action briefly to see whether a second click follows within a short window — a "wait to disambiguate" approach already used elsewhere in this codebase for tap-vs-long-press detection (`attachPressHandlers`, `attachClockPress`), just applied to click-vs-double-click instead of click-vs-hold.

Current (`wireGame()`):
```js
$('btn-miss') &&
  ($('btn-miss').onclick = () => {
    missArm = !missArm;
    render();
  });
```

Becomes:
```js
let missClickTimer = null;
$('btn-miss') &&
  ($('btn-miss').onclick = () => {
    if (missClickTimer) {
      clearTimeout(missClickTimer);
      missClickTimer = null;
      missLock = !missLock;
      missArm = false;
      render();
      return;
    }
    missClickTimer = setTimeout(() => {
      missClickTimer = null;
      if (!missLock) {
        missArm = !missArm;
        render();
      }
    }, 300);
  });
```

`missClickTimer` is declared alongside the other per-render local state inside `wireGame()` (it's re-created each render along with the rest of that function's closures, same as the function's other local variables) — no new module-level variable needed for the timer itself, only for `missLock`.

Behavior:
- **First click**: starts a 300ms timer. If no second click arrives, the timer fires and behaves exactly like today's single-click toggle — *unless* `missLock` is currently `true`, in which case the single click is a no-op (per the approved design decision: only a double-click can turn lock off once it's on).
- **Second click within 300ms**: cancels the pending single-click timer, toggles `missLock`, and force-clears `missArm` (lock and one-shot-arm are mutually exclusive — entering or leaving lock mode always yields a clean state, never a lingering one-shot arm underneath).

This means a normal single click on an *unlocked* MISS button now takes effect ~300ms after the tap instead of instantly — a small, one-time latency tradeoff needed to distinguish it from the first half of a double-click.

### Shot recording

Current (`attachPressHandlers`, inside `btn.onclick`):
```js
const hasTeam = !!selectedTeam(state.game);
if (SHOT_INFO[stat] && missArm && hasTeam) {
  missArm = false;
  flashKey = stat;
  recordSelectedStat(stat, { made: false });
} else {
  if (hasTeam) flashKey = stat;
  recordSelectedStat(stat);
}
```

Becomes:
```js
const hasTeam = !!selectedTeam(state.game);
if (SHOT_INFO[stat] && (missArm || missLock) && hasTeam) {
  if (!missLock) missArm = false;
  flashKey = stat;
  recordSelectedStat(stat, { made: false });
} else {
  if (hasTeam) flashKey = stat;
  recordSelectedStat(stat);
}
```

When `missLock` is true, `missArm` is never touched here (it's already `false`, forced by the click handler), so the miss keeps recording on every subsequent shot until the user double-clicks MISS again. When only `missArm` is true (normal one-shot), behavior is unchanged from today — it disarms immediately after recording.

### Rendering

Current (`renderControls`):
```js
<button id="btn-miss" class="${missArm ? 'armed' : ''}">MISS</button>
```

Becomes:
```js
<button id="btn-miss" class="${missArm || missLock ? 'armed' : ''}${missLock ? ' locked' : ''}">MISS</button>
```

### CSS

Add, near the existing `#btn-miss.armed` rule in `styles.css`:
```css
#btn-miss.locked {
  border-color: var(--accent);
}
```

This layers on top of `.grid button`'s existing `border: 1px solid var(--border)` (only the color changes, not the width) and `#btn-miss.armed`'s red background — matching the same "just override border-color" pattern already used by `.pl.sel` for the selected-player highlight.

## Testing

This is UI-state/interaction behavior with no existing pure-function coverage to extend (`recordStat` itself is unaware of `missArm`/`missLock` — those are purely `attachPressHandlers`/`wireGame` concerns, not part of the testable game-logic layer covered by `logic.test.js`). No automated test applies; matches the precedent of prior click/interaction-only changes in this app. Manual verification (deferred to the user, since this sandbox has no browser):

1. Single-click MISS (not locked): after a brief pause, it turns red (armed) same as today; tapping a shot records a miss and it turns back off.
2. Double-click MISS: it turns red with an accent-colored border (locked). Tap several different shots in a row — each records as a miss, and MISS stays red/bordered the whole time (does not clear after the first one).
3. While locked, a single click on MISS does nothing (stays locked).
4. Double-click MISS again while locked: it turns off (back to normal, no red, no border).
5. Start a new game (or discard/create a new one): MISS is not locked or armed at the start.
