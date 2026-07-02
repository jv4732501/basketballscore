# Team Stat (Fouls/TO/Score) Long-Press Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-pressing the score number, "FOULS: N", or "TO: N" for either team opens a modal dialog listing the log entries that contributed to that team's count — mirroring the existing player long-press Activity dialog, but team+stat-scoped instead of player-scoped.

**Architecture:** One task touching `app.js` (new `attachStatPress`, new `openTeamActivityDialog`, markup changes in `renderGame()`, one new wiring call in `wireGame()`) and `styles.css` (extend one existing selector list, no new rule).

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), no build step.

## Global Constraints

- Long-press goes straight to the dialog — no intermediate popover (unlike the player flow, which has a two-item popover because it also offers Sub In/Out).
- A short tap on the score number, "FOULS: N", or "TO: N" must remain a no-op, exactly as it is today.
- The existing player long-press Activity/Sub In-Out flow (`attachPlayerPress`, `openPlayerMenu`, `openActivityDialog`) is untouched.
- The +/- adjustment buttons next to Fouls/TO keep working exactly as before — the new long-press wrapper only covers the label text, not the buttons.
- Fouls activity includes log types `foul` and `team_foul_adj`. Score activity includes `2pt_made`, `3pt_made`, `ft_made`, and `score_adj`. Timeouts activity includes only `timeout_adj`. These are the exact values — do not add or omit any.

---

### Task 1: Add attachStatPress, openTeamActivityDialog, markup, wiring, and CSS

**Files:**
- Modify: `app.js:1244-1263` (`renderGame()` score-box markup for both teams), `app.js:1266-1281` (`renderGame()` infobar Fouls/TO markup for both teams), `app.js:1362` (`wireGame()` wiring — add a line after the existing `data-pl` wiring), and add two new functions (`attachStatPress`, `openTeamActivityDialog`) near the existing `attachPlayerPress`/`openActivityDialog` functions (around line 1624, right before `function closeActivityDialog()`)
- Modify: `styles.css:526-533` (the "Long-press targets" shared selector list)

**Interfaces:**
- Produces: `attachStatPress(btn)` — reads `btn.dataset.actlog` (format `"<kind>:<team>"`, `kind` ∈ `fouls`/`to`/`score`); `openTeamActivityDialog(kind, team)` — opens the dialog, reuses the existing `closeActivityDialog()` to close it (no changes needed to that function).

- [ ] **Step 1: Add `data-actlog` to the score number in both score-boxes**

In `app.js`, inside `renderGame()`, find (there are two near-identical lines, one per team — change both):

```js
        <div class="sc">${g.score[leftTeam]}</div>
```
and
```js
        <div class="sc">${g.score[rightTeam]}</div>
```

Replace with:
```js
        <div class="sc" data-actlog="score:${leftTeam}">${g.score[leftTeam]}</div>
```
and
```js
        <div class="sc" data-actlog="score:${rightTeam}">${g.score[rightTeam]}</div>
```

- [ ] **Step 2: Wrap the Fouls and TO label text in `.statlbl` spans**

In `app.js`, inside `renderGame()`, find this exact block:

```js
    <div class="infobar">
      <span class="tf">FOULS: ${tf[leftTeam]}
        <button class="tfadj" data-tf="${leftTeam}:-1" ${g.teamFouls[leftTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-tf="${leftTeam}:1">+</button> ${bonusBadge(leftTeam)}</span>
      <button id="poss">POS: ${g.possession === leftTeam ? '◀' : '▶'}</button>
      <span class="tf">FOULS: ${tf[rightTeam]}
        <button class="tfadj" data-tf="${rightTeam}:-1" ${g.teamFouls[rightTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-tf="${rightTeam}:1">+</button> ${bonusBadge(rightTeam)}</span>
    </div>
    <div class="infobar small">
      <span class="tf">TO: ${g.timeouts[leftTeam]}
        <button class="tfadj" data-to="${leftTeam}:-1" ${g.timeouts[leftTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-to="${leftTeam}:1">+</button></span>
      <span class="period-ctl">${
        g.period < g.config.numHalves
          ? `<button id="btn-endhalf">END HALF</button>`
          : `<button id="btn-endgame">END GAME</button><button id="btn-ot">+OT</button>`
      }</span>
      <span class="tf">TO: ${g.timeouts[rightTeam]}
        <button class="tfadj" data-to="${rightTeam}:-1" ${g.timeouts[rightTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-to="${rightTeam}:1">+</button></span>
    </div>
```

Replace with:

```js
    <div class="infobar">
      <span class="tf"><span class="statlbl" data-actlog="fouls:${leftTeam}">FOULS: ${tf[leftTeam]}</span>
        <button class="tfadj" data-tf="${leftTeam}:-1" ${g.teamFouls[leftTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-tf="${leftTeam}:1">+</button> ${bonusBadge(leftTeam)}</span>
      <button id="poss">POS: ${g.possession === leftTeam ? '◀' : '▶'}</button>
      <span class="tf"><span class="statlbl" data-actlog="fouls:${rightTeam}">FOULS: ${tf[rightTeam]}</span>
        <button class="tfadj" data-tf="${rightTeam}:-1" ${g.teamFouls[rightTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-tf="${rightTeam}:1">+</button> ${bonusBadge(rightTeam)}</span>
    </div>
    <div class="infobar small">
      <span class="tf"><span class="statlbl" data-actlog="to:${leftTeam}">TO: ${g.timeouts[leftTeam]}</span>
        <button class="tfadj" data-to="${leftTeam}:-1" ${g.timeouts[leftTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-to="${leftTeam}:1">+</button></span>
      <span class="period-ctl">${
        g.period < g.config.numHalves
          ? `<button id="btn-endhalf">END HALF</button>`
          : `<button id="btn-endgame">END GAME</button><button id="btn-ot">+OT</button>`
      }</span>
      <span class="tf"><span class="statlbl" data-actlog="to:${rightTeam}">TO: ${g.timeouts[rightTeam]}</span>
        <button class="tfadj" data-to="${rightTeam}:-1" ${g.timeouts[rightTeam] === 0 ? 'disabled' : ''}>−</button><button class="tfadj" data-to="${rightTeam}:1">+</button></span>
    </div>
```

Only the inner text of each `.tf` span gained a `.statlbl` wrapper — the `#poss` button, `.period-ctl` section, and all `.tfadj` buttons are unchanged.

- [ ] **Step 3: Add the wiring call in `wireGame()`**

In `app.js`, find this line (inside `wireGame()`):

```js
  el_each('[data-pl]', (b) => attachPlayerPress(b));
```

Add a new line immediately after it:

```js
  el_each('[data-pl]', (b) => attachPlayerPress(b));
  el_each('[data-actlog]', (b) => attachStatPress(b));
```

- [ ] **Step 4: Add `attachStatPress` and `openTeamActivityDialog`**

In `app.js`, find this line:

```js
function closeActivityDialog() {
```

Add the two new functions immediately **before** it (so `closeActivityDialog` stays exactly where it is, right after these new additions):

```js
function attachStatPress(btn) {
  const [kind, team] = btn.dataset.actlog.split(':');
  let timer = null;
  const start = () => {
    timer = setTimeout(() => openTeamActivityDialog(kind, team), 500);
  };
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  btn.addEventListener('touchstart', start, { passive: true });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress long-press browser menu
}

const STAT_LOG_TYPES = {
  fouls: ['foul', 'team_foul_adj'],
  to: ['timeout_adj'],
  score: ['2pt_made', '3pt_made', 'ft_made', 'score_adj'],
};
const STAT_LOG_LABELS = { fouls: 'Fouls', to: 'Timeouts', score: 'Score' };

function openTeamActivityDialog(kind, team) {
  const g = state.game;
  const types = STAT_LOG_TYPES[kind];
  const events = g.log.filter((e) => e.team === team && types.includes(e.type)).reverse();
  const rows = events.length
    ? events
        .map(
          (e) =>
            `<div class="ev">${e.clockText} ${periodLabel(e.period, g.config.numHalves)} — ${esc(e.detail)}</div>`,
        )
        .join('')
    : `<p class="muted">No activity yet</p>`;
  const back = document.createElement('div');
  back.className = 'dlgback';
  back.addEventListener('pointerdown', closeActivityDialog);
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.innerHTML = `<h3>${esc(teamDisplayName(g, team))} ${STAT_LOG_LABELS[kind]}</h3><div class="dlgbody">${rows}</div><button class="dlgclose">Close</button>`;
  dlg.querySelector('.dlgclose').addEventListener('click', closeActivityDialog);
  document.body.appendChild(back);
  document.body.appendChild(dlg);
}

function closeActivityDialog() {
```

`STAT_LOG_TYPES` and `STAT_LOG_LABELS` are module-level constants (like the existing `SHOT_INFO`/`PLAIN_LABEL` earlier in the file) — declare them once, not inside the function.

- [ ] **Step 5: Extend the long-press-suppression CSS rule**

In `styles.css`, find:

```css
/* Long-press targets: suppress text selection + the touch callout that triggers the context menu. */
.pl,
.grid button,
.clkstep {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

Replace with:

```css
/* Long-press targets: suppress text selection + the touch callout that triggers the context menu. */
.pl,
.grid button,
.clkstep,
.statlbl,
.sc {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

- [ ] **Step 6: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` — this change adds new UI-interaction code and markup; it doesn't modify any pure game-logic function, so the existing suite must be unaffected.

- [ ] **Step 7: Commit**

```bash
git add app.js styles.css
git commit -m "Add long-press activity log for Fouls, Timeouts, and Score"
```

- [ ] **Step 8: Manual verification (deferred to the user)**

There is no automated test for this (UI-interaction/rendering code with no pure-function equivalent — mirrors the existing player Activity dialog, which also has none). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. Long-press the score number for either team — opens a dialog titled "`<Team>` Score" listing that team's made shots and manual score adjustments, newest first (or "No activity yet" if none recorded).
2. Long-press "FOULS: N" for either team — opens a dialog titled "`<Team>` Fouls" listing that team's player fouls and manual team-foul adjustments.
3. Long-press "TO: N" for either team — opens a dialog titled "`<Team>` Timeouts" listing manual timeout adjustments.
4. A short tap on the score number, "FOULS: N", or "TO: N" does nothing.
5. The +/- buttons next to Fouls/TO still work normally.
6. The existing player long-press Activity/Sub In-Out flow still works unchanged.
