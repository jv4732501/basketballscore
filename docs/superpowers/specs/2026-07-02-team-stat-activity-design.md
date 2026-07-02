# Team Stat (Fouls/TO/Score) Long-Press Activity Log

## Problem

Long-pressing a player currently opens a popover ("Activity" / "Sub In-Out"), and choosing "Activity" opens a modal dialog listing every log entry for that player (`openActivityDialog`, filtered by `playerId`). There's no equivalent way to see what's driven a *team's* Fouls, Timeouts (TO), or Score counts — only the running number is visible, with +/- buttons to adjust it manually. This adds the same "long-press to see a filtered activity log" interaction to the Fouls label, TO label, and the score number, scoped per-team (each side of the header/infobar has its own team).

## Scope

- `app.js`: new `attachStatPress(btn)` (long-press-only, no competing tap action), new `openTeamActivityDialog(kind, team)` (reuses the existing dialog markup and `closeActivityDialog()`), markup changes in `renderGame()` to add long-press targets for Score/Fouls/TO on both teams, and a new `el_each('[data-actlog]', ...)` wiring call in `wireGame()`.
- `styles.css`: extend the existing shared long-press-suppression rule with two more selectors (`.statlbl`, `.sc`) — no new CSS rule.
- Out of scope: the existing player Activity dialog and its popover menu are untouched; no change to the +/- adjustment buttons' own behavior; no popover step for Fouls/TO/Score (long-press goes straight to the dialog, since there's no second action like Sub In/Out to offer alongside it).

## Approach

### Interaction

Unlike player long-press (which must distinguish "tap to select" from "long-press to open a menu"), Fouls/TO/Score labels currently have no tap behavior at all — so the new long-press handler doesn't need to suppress a competing click; it's simply "hold 500ms → open the dialog," using the same touchstart/touchend/mousedown/mouseup/mouseleave timer pattern already used for players and the clock, just without an `onclick`.

### Markup (`renderGame()`)

Score (currently `<div class="sc">${g.score[leftTeam]}</div>`) gains a `data-actlog` attribute directly:
```html
<div class="sc" data-actlog="score:${leftTeam}">${g.score[leftTeam]}</div>
```

Fouls (currently bare text inside `<span class="tf">`) gets its count text wrapped in a new `<span class="statlbl">`, leaving the +/- buttons and bonus badge as siblings, untouched:
```html
<span class="tf"><span class="statlbl" data-actlog="fouls:${leftTeam}">Fouls: ${tf[leftTeam]}</span>
  <button class="tfadj" data-tf="${leftTeam}:-1" ...>−</button><button class="tfadj" data-tf="${leftTeam}:1">+</button> ${bonusBadge(leftTeam)}</span>
```

TO, same pattern:
```html
<span class="tf"><span class="statlbl" data-actlog="to:${leftTeam}">TO: ${g.timeouts[leftTeam]}</span>
  <button class="tfadj" data-to="${leftTeam}:-1" ...>−</button><button class="tfadj" data-to="${leftTeam}:1">+</button></span>
```

Same three changes are mirrored for `rightTeam`. `data-actlog`'s value is `"<kind>:<team>"` (kind ∈ `fouls`/`to`/`score`), split on `:` the same way `data-pl` (`"<team>:<id>"`) already is for players.

### `attachStatPress` and wiring (`app.js`)

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
```

Wired in `wireGame()` alongside the existing player wiring:
```js
el_each('[data-pl]', (b) => attachPlayerPress(b));
el_each('[data-actlog]', (b) => attachStatPress(b));
```

### `openTeamActivityDialog(kind, team)` (`app.js`)

Filters the game log by team and by the set of log `type`s that contribute to that stat, using the same rendering shape as `openActivityDialog` (newest-first, `.ev` rows, "No activity yet" fallback, same `.dlgback`/`.dialog`/`.dlgclose` elements, closed via the existing `closeActivityDialog()`):

```js
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
```

`e.team` is reliably set on every relevant log entry: `recordStat` (source of `foul`/`2pt_made`/`3pt_made`/`ft_made`) and `adjustScore`/`adjustTeamFouls`/`adjustTimeouts` (source of `score_adj`/`team_foul_adj`/`timeout_adj`) all pass `team` into `pushLog`.

Per the approved scope: **Fouls** includes both individual player fouls (`foul`) and manual team-foul adjustments (`team_foul_adj`) — everything that changed the count. **Score** includes made shots (`2pt_made`/`3pt_made`/`ft_made` — misses don't affect score, so they're excluded) and manual adjustments (`score_adj`). **Timeouts** only ever changes via manual adjustment (`timeout_adj`), so that's its only type.

### CSS (`styles.css`)

Extend the existing shared rule (no new rule):
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

## Testing

This is UI-interaction/rendering code with no pure-function equivalent to unit test (mirrors the existing player Activity dialog, which also has no test coverage — `openActivityDialog` itself isn't exported/tested, only the underlying `recordStat`/log-producing functions are). No automated test applies. Manual verification (deferred to the user, since this sandbox has no browser):

1. Long-press the score number for either team — opens a dialog titled "`<Team>` Score" listing that team's made shots and manual score adjustments, newest first (or "No activity yet" if none).
2. Long-press "Fouls: N" for either team — opens a dialog titled "`<Team>` Fouls" listing that team's player fouls and manual team-foul adjustments.
3. Long-press "TO: N" for either team — opens a dialog titled "`<Team>` Timeouts" listing manual timeout adjustments.
4. A short tap on the score number, "Fouls: N", or "TO: N" does nothing (no dialog, no other effect) — same as before this change.
5. The +/- buttons next to Fouls/TO still work normally and are unaffected by the new long-press wrapper around the label text.
6. The existing player long-press Activity/Sub In-Out flow is unaffected.
