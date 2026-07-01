# Miss Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MISS button that arms "next shot is a miss" (quick taps), rearrange the controls grid to include it, and make UNDO a single cell.

**Architecture:** One shell-only change to `app.js` + `styles.css`. No game-logic change — a miss is recorded through the existing `recordStat(..., { made:false })` path. `missArm` is transient shell UI state.

**Tech Stack:** Vanilla JS (ES2020+), HTML, CSS. Node's built-in `node --test`.

## Global Constraints

- **No runtime dependencies, no build step, no network.** App is `index.html` + `styles.css` + `app.js`.
- **`app.js` must stay `require()`-able in Node with no DOM** — no top-level `document`/`window`/`localStorage`. Verify with `node -e "require('./app.js'); console.log('loads OK')"`.
- **No game-logic change** — the test suite stays at 52/52. A miss uses the already-tested `recordStat(..., { made:false })`.
- **`commit(producer)` is the single in-game mutation path**; the miss tap routes through it (via `recordSelectedStat`).
- **Test runner:** `node --test`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Grid order (chosen):** `2PT 3PT FT / MISS OREB DREB / STL BLK AST / TOVR FOUL UNDO`; UNDO is a single cell (no span).

---

## File Structure

- `app.js` — add `missArm` shell state; MISS button + reordered grid in `renderControls`; MISS toggle in `wireGame`; miss-aware shot tap in `attachPressHandlers`; reset `missArm` in `startGame`/`openHistoryGame`.
- `styles.css` — drop `.grid .undo` span; add `#btn-miss.armed` red style.

---

## Task 1: MISS button (arm-next-shot) + grid rearrange

**Files:**
- Modify: `app.js` (`renderControls`, `wireGame`, `attachPressHandlers`, `startGame`, `openHistoryGame`, new `missArm` var), `styles.css`

**Interfaces:**
- Consumes: `SHOT_INFO`, `selectedTeam`, `recordSelectedStat`, `commit`, `render`, `el_each` (existing).
- Produces: module-level `missArm` (boolean shell state); a `#btn-miss` button in the grid that arms/disarms it; shot taps record `made:false` while armed.

Shell-only; verified by load-check + manual QA.

- [ ] **Step 1: Add the `missArm` state**

In `app.js`, near the other shell UI state (next to `let addOpen = null;`), add:
```js
let missArm = false;   // when true, the next shot tap records a miss, then disarms
```

- [ ] **Step 2: Add MISS to the grid and reorder (`renderControls`)**

Replace the `.grid` block in `renderControls` so MISS sits under the shots and UNDO is a plain cell:
```js
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
```
(Order = 2PT,3PT,FT, MISS, OREB,DREB,STL,BLK,AST,TOVR, FOUL, UNDO → 12 cells in the 3-col grid, matching the chosen layout.)

- [ ] **Step 3: Wire the MISS toggle (`wireGame`)**

In `app.js` `wireGame`, add a handler (e.g. right after the `[data-stat]` wiring block):
```js
  $('btn-miss') && ($('btn-miss').onclick = () => { missArm = !missArm; render(); });
```

- [ ] **Step 4: Make the shot tap miss-aware (`attachPressHandlers`)**

In `app.js` `attachPressHandlers`, replace the final `btn.onclick` line:
```js
  btn.onclick = () => { if (longFired) { longFired = false; return; } recordSelectedStat(stat); };
```
with:
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
(Only a shot, while armed, with a player selected, records a miss and consumes the arm. A non-shot tap or an unselected tap leaves `missArm` as it was — it waits for a real shot. `recordSelectedStat` → `commit` → `render`, which re-renders MISS in its now-disarmed state.)

- [ ] **Step 5: Reset `missArm` on game-entry transitions**

In `app.js`, add `missArm = false;` next to the existing `addOpen = null;` in both `startGame` and `openHistoryGame`, so a stale arm never carries into a new/reopened game.

- [ ] **Step 6: CSS — UNDO single cell + armed MISS**

In `styles.css`, remove the span rule:
```css
.grid .undo { grid-column:span 2; }
```
and add an armed style for MISS (near the `.grid` rules):
```css
#btn-miss.armed { background:#dc2626; color:#fff; }
```

- [ ] **Step 7: Verify Node load + commit**

Run: `node --test` (still 52/52 — no logic changed) and `node -e "require('./app.js'); console.log('loads OK')"`
Expected: tests pass; `loads OK`.

```bash
git add app.js styles.css
git commit -m "feat: MISS button (arm next shot as a miss) + grid rearrange"
```

Manual browser check (deferred): the grid shows `2PT 3PT FT / MISS OREB DREB / STL BLK AST / TOVR FOUL UNDO`; tapping MISS turns it red; with a player selected, the next 2PT/3PT/FT tap records a miss (attempt only, no points) and MISS returns to normal; tapping MISS twice disarms without recording; long-press on a shot still opens the Miss/modifier menu; UNDO is a single full-size button.

---

## Notes for the implementer

- **No new tests** — this is shell only; `recordStat(made:false)` is already covered. Confirm the suite stays 52/52 and `app.js` still loads in Node.
- **`missArm` is shell-only** — not added to the game object, not persisted; it lives beside `addOpen`.
- **Keep `commit` as the one mutation path** — the miss tap goes through `recordSelectedStat` → `commit`.
