# Center Button Click Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 12 center-column stat buttons (2PT, 3PT, FT, MISS, OREB, DREB, STL, BLK, AST, TOVR, FOUL, UNDO) flash blue for 500ms when clicked, without being fooled by the fact that every click rebuilds the whole `#game` panel's DOM.

**Architecture:** Module-level `flashKey` state (same pattern as the existing `missArm` flag) records which button was just clicked. `renderControls` consumes it once per render, attaching a `flash` class to that button's freshly-created element. A CSS `@keyframes` animation on that class plays automatically whenever the class is present the moment the element is inserted into the DOM — no `setTimeout` add/remove bookkeeping needed, and it can't go stale because it's cleared the instant it's read.

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), no build step, no new dependencies. Existing test runner is Node's built-in `node:test` (`node --test`), covering only pure game logic — this feature has no logic to unit test, per `docs/superpowers/specs/2026-07-01-center-button-click-flash-design.md`.

## Global Constraints

- No new dependencies, no build step — the app stays a static 3-file (`index.html`/`styles.css`/`app.js`) deploy.
- Flash must last exactly 500ms and only fire on genuine short clicks, never on long-press-to-open-modifier-menu.
- `flashKey` must be cleared the moment it's consumed by `renderControls`, so a later unrelated render (e.g. from clicking a score-adjust button) can never replay a stale flash on the wrong button.

---

### Task 1: Add flash state, CSS animation, and wire clicks

**Files:**
- Modify: `app.js:475` (add module state), `app.js:1003-1019` (`renderControls`), `app.js:1066-1067` (`btn-miss`/`btn-undo` onclick), `app.js:1118-1126` (`attachPressHandlers` onclick)
- Modify: `styles.css:81` area (add keyframes + `.flash` rule)

**Interfaces:**
- Produces: module-level `let flashKey = null;` in `app.js`, readable/writable by any click handler and by `renderControls`. Values used: `'2pt'`, `'3pt'`, `'ft'`, `'oreb'`, `'dreb'`, `'stl'`, `'blk'`, `'ast'`, `'to'`, `'foul'`, `'btn-miss'`, `'btn-undo'`.
- Produces: CSS class `flash` (defined in `styles.css`), consumed by `renderControls`'s generated markup.

- [ ] **Step 1: Add the `flashKey` module state**

In `app.js`, right after the existing `missArm` declaration:

```js
let addOpen = null;   // 'my' | 'opp' | null — which column's add-form is open
let missArm = false;   // when true, the next shot tap records a miss, then disarms
let flashKey = null;   // key of the grid button to flash blue on the next render, or null
```

- [ ] **Step 2: Add the CSS keyframe animation**

In `styles.css`, immediately after the existing `.grid button { ... }` rule (the line starting `.grid button { padding:12px; ... }`):

```css
@keyframes flashBlue { 0% { background:#3b82f6; } 100% { background:var(--btn-bg); } }
.grid button.flash { animation: flashBlue 500ms ease-out; }
```

- [ ] **Step 3: Update `renderControls` to consume `flashKey` and tag the clicked button**

Replace the current `renderControls` function body:

```js
function renderControls(g) {
  const recent = g.log.slice(-10).reverse()
    .map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`)
    .join('');
  return `
    <div class="grid">
      <button data-stat="2pt">2PT</button>
      <button data-stat="3pt">3PT</button>
      <button data-stat="ft">FT</button>
      <button id="btn-miss" class="${missArm?'armed':''}">MISS</button>
      ${['oreb','dreb','stl','blk','ast','to'].map((s)=>`<button data-stat="${s}">${s==='to'?'TOVR':s.toUpperCase()}</button>`).join('')}
      <button data-stat="foul">FOUL</button>
      <button id="btn-undo" class="undo">UNDO</button>
    </div>
    <div class="recent">${recent}</div>
  `;
}
```

with:

```js
function renderControls(g) {
  const recent = g.log.slice(-10).reverse()
    .map((e)=>`<div class="ev">${e.clockText} ${periodLabel(e.period,g.config.numHalves)} — ${esc(e.detail)}</div>`)
    .join('');
  const flashClass = (key) => {
    if (flashKey === key) { flashKey = null; return ' flash'; }
    return '';
  };
  return `
    <div class="grid">
      <button data-stat="2pt" class="${flashClass('2pt')}">2PT</button>
      <button data-stat="3pt" class="${flashClass('3pt')}">3PT</button>
      <button data-stat="ft" class="${flashClass('ft')}">FT</button>
      <button id="btn-miss" class="${missArm?'armed':''}${flashClass('btn-miss')}">MISS</button>
      ${['oreb','dreb','stl','blk','ast','to'].map((s)=>`<button data-stat="${s}" class="${flashClass(s)}">${s==='to'?'TOVR':s.toUpperCase()}</button>`).join('')}
      <button data-stat="foul" class="${flashClass('foul')}">FOUL</button>
      <button id="btn-undo" class="undo${flashClass('btn-undo')}">UNDO</button>
    </div>
    <div class="recent">${recent}</div>
  `;
}
```

- [ ] **Step 4: Set `flashKey` in the `btn-miss` and `btn-undo` click handlers**

In `app.js`, inside `wireGame()`, replace:

```js
  $('btn-miss') && ($('btn-miss').onclick = () => { missArm = !missArm; render(); });
  $('btn-undo') && ($('btn-undo').onclick = () => commit((game)=>undo(game)));
```

with:

```js
  $('btn-miss') && ($('btn-miss').onclick = () => { flashKey = 'btn-miss'; missArm = !missArm; render(); });
  $('btn-undo') && ($('btn-undo').onclick = () => { flashKey = 'btn-undo'; commit((game)=>undo(game)); });
```

Both handlers always trigger a render (`render()` or `commit()` unconditionally), so `flashKey` is guaranteed to be consumed on the very next render — no risk of it going stale.

- [ ] **Step 5: Set `flashKey` in the shot/stat button click handler, only when a commit will actually happen**

In `app.js`, in `attachPressHandlers`, replace the `onclick` assignment:

```js
  btn.onclick = () => {
    if (longFired) { longFired = false; return; }
    if (SHOT_INFO[stat] && missArm && selectedTeam(state.game)) {
      missArm = false;
      recordSelectedStat(stat, { made:false });
    } else {
      recordSelectedStat(stat);
    }
  };
```

with:

```js
  btn.onclick = () => {
    if (longFired) { longFired = false; return; }
    const hasTeam = !!selectedTeam(state.game);
    if (SHOT_INFO[stat] && missArm && hasTeam) {
      missArm = false;
      flashKey = stat;
      recordSelectedStat(stat, { made:false });
    } else {
      if (hasTeam) flashKey = stat;
      recordSelectedStat(stat);
    }
  };
```

`recordSelectedStat` itself no-ops (no commit, no render) when `selectedTeam(state.game)` is falsy — the `hasTeam` check here mirrors that exactly, so `flashKey` is only ever set when a render is guaranteed to follow and consume it.

- [ ] **Step 6: Run the existing test suite to confirm no regressions**

Run: `node --test`
Expected: all existing tests pass (this change adds no new logic covered by `logic.test.js`, only rendering/state used purely for the DOM).

- [ ] **Step 7: Manual browser verification**

Open `index.html` directly in a browser (or `python -m http.server` and navigate to it), start a game so the center grid is visible, select a player, then:

1. Click 2PT, 3PT, FT, OREB, DREB, STL, BLK, AST, TOVR, FOUL, MISS, and UNDO one at a time — confirm each flashes blue and fades back over ~500ms.
2. Press and hold a shot button (e.g. 2PT) for the modifier popover to open — confirm the button does **not** flash.
3. Click MISS to arm it (confirm it flashes and turns red/`armed`), then click 2PT (confirm 2PT flashes, MISS's red `armed` state clears without re-flashing).
4. Deselect the current player (or start a fresh game with no player selected) and click a stat button — confirm nothing happens (existing behavior) and that this doesn't cause some *other* button to flash on your next real action.
5. Click buttons in quick succession — confirm only the just-clicked button ever flashes, never a previous one.

- [ ] **Step 8: Commit**

```bash
git add app.js styles.css
git commit -m "Add 500ms blue flash animation to center control buttons on click"
```
