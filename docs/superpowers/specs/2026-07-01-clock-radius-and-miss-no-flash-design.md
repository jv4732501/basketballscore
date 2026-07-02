# Clock Button Border-Radius + MISS Button No-Flash

## Problem

Two small, independent visual tweaks to the game screen:

1. The clock START/STOP button (`#clk-toggle`) has no explicit `border-radius` (falls back to the browser default), while the center-column scoring buttons (2PT/3PT/FT, etc. — `.grid button`) use a consistent `border-radius: 6px`. Give the clock button the same 6px radius so it visually matches the scoring buttons.
2. The MISS button (`#btn-miss`) currently flashes blue like every other center-grid button on click (via the `flash` class added in the 2026-07-01 click-flash feature). Since MISS already has its own distinct visual state — it turns red (`#btn-miss.armed { background:#dc2626; color:#fff; }`, styles.css) while armed — the blue flash is redundant and should be removed specifically for this button, without affecting the flash behavior of any other grid button.

## Scope

- `styles.css`: add a `border-radius: 6px` rule for `#clk-toggle`.
- `app.js`: stop setting `flashKey = 'btn-miss'` in the MISS button's click handler (`wireGame()`), and drop the now-unused `flashClass('btn-miss')` call from `renderControls`'s MISS button markup.
- Out of scope: no other button's radius or flash behavior changes. No change to the armed/red state logic.

## Approach

### Clock button radius

Currently (`styles.css`):
```css
.grid button { padding:12px; font-weight:700; background:var(--btn-bg); color:var(--btn-text); border:1px solid var(--border); border-radius:6px; }
```
```css
#clk-toggle.start { background:#16a34a; color:#fff; border:none; }
#clk-toggle.stop { background:#dc2626; color:#fff; border:none; }
```

Add a standalone `#clk-toggle { border-radius:6px; }` rule so both the `.start` and `.stop` states inherit the 6px radius (neither state rule currently sets `border-radius`, so this applies regardless of state). This is purely additive — no existing rule is modified.

### MISS button: stop flashing

Currently, the MISS click handler in `wireGame()` reads:
```js
$('btn-miss') && ($('btn-miss').onclick = () => { flashKey = 'btn-miss'; missArm = !missArm; render(); });
```
and `renderControls` renders it as:
```js
<button id="btn-miss" class="${missArm?'armed':''}${flashClass('btn-miss')}">MISS</button>
```

Remove `flashKey = 'btn-miss';` from the click handler (MISS still toggles `missArm` and re-renders, just without queuing a flash), and remove the `flashClass('btn-miss')` call from the button's `class` attribute, leaving:
```js
<button id="btn-miss" class="${missArm?'armed':''}">MISS</button>
```

No other grid button's `flashKey`/`flashClass` wiring changes — 2PT, 3PT, FT, OREB, DREB, STL, BLK, AST, TOVR, FOUL, and UNDO continue to flash blue exactly as before.

## Testing

Pure CSS/markup tweaks — no logic change, no automated test coverage applies (matches the precedent set by the click-flash and linting changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Start a game and confirm the START/STOP button's corners now match the 6px rounding of the 2PT/3PT/FT buttons.
2. Click MISS and confirm it still turns red (armed) with no blue flash.
3. Click any other grid button (e.g. 2PT) and confirm it still flashes blue as before.
