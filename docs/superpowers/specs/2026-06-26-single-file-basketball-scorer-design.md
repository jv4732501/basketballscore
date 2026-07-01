# Single-File Basketball Scorer — Design Spec

**Date:** 2026-06-26 (rev. 2026-06-28)
**Status:** v1.0 + live-game enhancements built; shooting/rebound controls in design

**Revision 2026-06-27 — live-game enhancements:** both teams now record the
**full** stat set (the opponent is no longer limited to points + fouls); **team
fouls can be adjusted manually** with +/- controls; the **recent-events log and
UNDO moved into the center column**. Dark mode (also post-v1.0) is under Theming.

**Revision 2026-06-28 — shooting & rebound controls (this cycle):** the MAKE/MISS
toggle is replaced by **quick-tap = made, long-press = a real in-DOM menu offering
Miss + shot modifiers** (a miss is a real missed attempt, not a cosmetic tag);
rebounds split into **OREB/DREB** buttons (box score gains OREB, DREB, and a REB
total); the shot/stat buttons become **one grid** with **UNDO filling the empty
cells beside FOUL**. Sections below reflect these changes.

## Vision

A drastically simplified rewrite of the HoopScore app. The original is a React +
Supabase + Cloudflare D1/Pages PWA with season analytics, two game modes,
substitutions, sharing links, and ~407 tests. This version collapses to **three
committed static files** — `index.html` (markup), `styles.css` (all styling), and
`app.js` (vanilla JS) — with no build step, no runtime dependencies, and no
network. They can be committed to a GitHub repo and served directly by GitHub
Pages. All data lives in the browser's `localStorage`. It works fully offline
(e.g. a gym with no signal).

The game **logic** is factored into pure functions so it can be developed
test-first (see Testing). Tests are dev-only and never shipped — GitHub Pages
serves only `index.html` + `app.js`.

## Target Platform

- **Primary device:** iPhone 16, Safari, **portrait** orientation.
- **Layout:** Three-column game screen (left team / controls / right team).
- Any modern mobile browser also works. No install/PWA step.

## Non-Goals (dropped from the original)

- Authentication / Supabase
- Cloudflare D1, Pages Functions, server-rendered share links
- Season stats, game history, charts, player drill-downs
- Substitutions and minutes-played tracking
- Simple-vs-detailed mode toggle (this app is always detailed)
- PWA service worker / installability
- npm/Vite/TypeScript build tooling (tests use Node's built-in runner, no `npm install`)

---

## Architecture

Three static files, no build, no dependencies, no network calls at runtime:

- **`index.html`** — markup only, with a `<link rel="stylesheet" href="styles.css">`
  and a single `<script src="app.js">` tag.
- **`styles.css`** — all styling, including the `@media print` block used for the
  PDF-friendly summary.
- **`app.js`** — all JavaScript, split internally into two layers:
  - **Pure logic** — functions of the form `(state, args) → newState` (or
    `→ value`) with no DOM or `localStorage` access. This is the TDD'd core:
    clock math, stat recording, undo, bonus thresholds, period/OT transitions.
    These functions are also exported for the test runner (see Testing).
  - **Shell** — DOM rendering, event wiring, and persistence that call into the
    pure logic.

Organized as:

- **State** — one in-memory object that is the single source of truth, with two
  top-level sections: `teams` (saved rosters) and `game` (the current game).
- **Persistence** — `save()` serializes state to `localStorage` after every
  mutation; `load()` restores it on startup. A refresh, accidental tab close, or
  phone sleep never loses the in-progress game.
- **Render** — small per-screen `render()` functions rebuild the relevant DOM from
  state. Event handlers follow one pattern: call a pure logic function to produce
  new state → `save()` → re-render.
- **Screens** — three views toggled by a `screen` field: **Setup**, **Game**,
  **Summary**.

### localStorage keys

- `hoops.teams` — array of saved teams:
  `{ id, name, players: [{ id, num, name }] }`
- `hoops.game` — the in-progress (or just-finished) game (see Data Model). There
  is **no game history**: starting a new game clears `hoops.game`. The user is
  expected to print/share the summary before starting a new game.

---

## Data Model

```
game = {
  screen: "setup" | "game" | "summary",
  config: {
    halfLengthMin: 18,        // default
    numHalves: 2,             // default
    otLengthMin: 4,           // default
    myTeamSide: "home" | "away"   // DISPLAY ONLY — see "Team identity" below
  },
  myTeam:  { id, name, players: [ playerStat ] },
  oppTeam: { name, players: [ playerStat ] },   // same full playerStat shape as myTeam
  period: 1,                                    // integer index, 1-based (see note)
  clock: { remainingSec, running, startedAt },  // startedAt = epoch ms or null
  score:        { my, opp },                    // keyed by identity, not home/away
  possession:   "my" | "opp",
  teamFouls:    { my, opp },                     // reset each period; also manually adjustable
  timeouts:     { my, opp },                      // count used
  periodScores: [ { my, opp } ],                // cumulative score snapshot per ended period
  log: [ { id, period, clockText, team, playerId, type, detail, rev } ],  // team: "my"|"opp"
  selectedPlayerId: id | null,
  _seq: 0                                        // internal monotonic id counter for log entries
}
```

- **`period`** is stored as a 1-based integer (1 = first half) and rendered via a
  `periodLabel(period, numHalves)` helper → `"H1"`, `"H2"`, `"OT1"`, … This keeps
  period-transition math simple while still displaying the familiar labels.
- **`periodScores`** holds a `{ my, opp }` cumulative-score snapshot appended each
  time a period ends; the Summary derives per-period deltas from it.
- **`log[].rev`** is a compact, non-rendered reversal payload (inverse deltas) that
  lets UNDO reverse an entry exactly. Reversal kinds: `stat`, `score`, `possession`,
  `teamfoul` (manual team-foul adjustment), and `timeoutadj` (manual timeout
  adjustment). Some log entries are non-reversible (`clock_set` is gone;
  `end_period`/`end_game` carry no `rev`), and a clamped no-op adjustment writes no
  entry at all. **`_seq`** gives log entries deterministic integer ids (important
  for reproducible tests).

### Team identity vs Home/Away (avoids a known bug from the original)

The original app keyed everything on the home/away *slot* and assumed
"my team == home." Its "My team is Home/Away" toggle then physically swapped which
slot held the user's team, but downstream code (sync, saved-team persistence, stat
attribution) still treated the home slot as the user's team. Choosing "Away"
silently saved the opponent as your team and dropped your stats. We must not
repeat this.

**Rule:** All per-team state — `myTeam`/`oppTeam`, `score`, `possession`,
`teamFouls`, `timeouts`, and each `log` entry's `team` — is keyed by **identity
(`my` / `opp`)**, never by home/away. Both teams now record the **same full stat
set**, so stat *behavior* is symmetric; the identity rule still governs the one
thing that is not symmetric: **which roster is written back to `hoops.teams` is
always `myTeam`**, regardless of side.

`config.myTeamSide` is **display-only**: it tells the Game header and the Summary
which physical side (left/right, and the "home"/"away" labels) to render each team
on. It never affects stat behavior, persistence, or attribution. The Summary maps
`my`/`opp` → home/away purely for layout and W/L labeling.

### Player stat shape

**Both teams use the same full detailed shape:**
```
{ id, num, name,
  pts, fgm, fga, tpm, tpa, ftm, fta,  // shooting makes/attempts
  oreb, dreb, stl, blk, ast, to, pf } // rebounds (off/def) + other + personal fouls
```
- As of the 2026-06-27 revision both teams are symmetric (the opponent previously
  carried only `{ pts, pf }`).
- As of the 2026-06-28 revision rebounds are split into `oreb`/`dreb` (the old
  single `reb` field is gone); the box-score REB total is `oreb + dreb`.
- There is no `makeMode`: a shot's made/missed status is decided per action
  (quick tap = made; the long-press **Miss** option = missed attempt) and passed
  to `recordStat` as an explicit `made` flag.

---

## Setup Screen

A single screen, optimized for the fewest taps. There is **no "pick 5 starters"
step** — without substitutions, players are a flat list, so the whole roster just
plays. A typical start is: pick team → type a few opponent numbers → tap the tip
winner.

1. **My team** — a dropdown of saved teams; pick one. First run (or "+ New team"):
   type a name and add jersey numbers (optional player names) once; it's saved to
   `hoops.teams` and pre-selected next time. Editing a saved team's roster persists
   back to `hoops.teams`.
2. **Opponent** — type a name, then quick-add jersey numbers: type a number →
   Enter → repeat. Names optional.
3. **Settings** — collapsed by default with sensible defaults (half length 18 min,
   number of halves 2, OT length 4 min). Opened only to change them.
4. **My side** — a small Home / Away toggle, defaults to Home. Display-only (sets
   which physical side each team renders on; see "Team identity vs Home/Away").
5. **Start** — a "Who won the tip?" row with two buttons (my team / opponent).
   **Tapping one starts the game** and gives that team first possession. There is
   no separate Start button; the single tap does both. This is the only way to
   start a game.

### Resume an in-progress game

On app open, if `hoops.game` holds an unfinished game (screen was `game`), the
Setup screen shows a **"Resume game" banner** at the top (e.g. "Resume MyTeam vs
Opponent — H2 4:12") with two actions:

- **Resume** → jumps straight into the Game screen with all state restored.
- **Discard / Start fresh** → clears `hoops.game` and stays on Setup for a new
  game (confirm before discarding, since it can't be undone).

If there is no in-progress game, no banner is shown.

---

## Game Screen (portrait, three columns)

| Left team | Center (controls) | Right team |
|-----------|-------------------|------------|
| Flat list, **all** players, tappable. Shows #, name, PTS, fouls. | One 3-column button grid (2PT/3PT/FT, OREB/DREB/STL, BLK/AST/TO, FOUL + UNDO); recent-events log below. | Flat list, all players, tappable. Shows #, name, PTS, fouls. |

- **No on-court/bench distinction** (no subs). Every roster player is always shown.
- **Selection:** tap a player → gold highlight (the only selection indicator); they
  stay selected for consecutive entries. Tap a stat button → recorded at the current
  clock time and logged.
- **Both teams are symmetric:** every player on either team records the full
  detailed stat set. No stat button is ever disabled based on which team is
  selected. (Which physical side each team renders on follows `config.myTeamSide`.)
- **Shooting (2PT/3PT/FT):**
  - **Quick tap = a made shot** (points + make + attempt), no modifier.
  - **Long-press (500ms) opens an in-DOM popover** anchored to the button with a
    **Miss** option plus shot modifiers — 2PT → Miss/Layup/Dunk/Mid-range, 3PT →
    Miss/Long distance, FT → Miss.
  - **Miss is a real missed attempt** (attempt++ only, no points) so it feeds the
    end-of-game shooting percentages. The Layup/Dunk/Mid-range/Long-distance choices
    are cosmetic text appended to a *made* shot's log entry, e.g.
    `#5 Smith 2PT (Layup)`. There is **no MAKE/MISS toggle**.
- **Rebounds:** separate **OREB** and **DREB** buttons (one tap each), stored as
  `oreb`/`dreb`.
- **FOUL long-press** opens the same popover with Shooting / Technical / On the
  ground (cosmetic), e.g. `#5 Smith foul (Shooting)`.
- **UNDO** occupies the empty grid cells beside FOUL in the last row; it reverses
  the last logged action and its stat/score/foul/team-foul changes.
- **Recent-events** list (latest ~10) scrolls in the center column below the grid.
- **Header:** team names; each score with manual **+/−** adjust (logged, no player
  attribution; the − button is disabled at 0); the clock display flanked by **−/＋**
  nudge buttons (quick tap ±1s, long-press ±10s) with **START/STOP** and the period
  control (**END HALF**, or **END GAME / +OT** in the final/OT periods) beside it;
  period indicator.
- **Info bar:** team fouls per period with **B** (bonus, 7) and **BB** (double
  bonus, 10) badges shown after small **−/+ controls** that adjust the count
  manually (clamped ≥0, logged, undoable; − disabled at 0); a centered
  **possession arrow** (tap to toggle, logged); a **timeouts** row per team with the
  same **−/+ controls** (timeouts are a plain counter — no clock side-effect).
- **No footer** — period control lives in the header next to START/STOP.

---

## Timer

- Counts down from the current period length.
- Manual **START/STOP** toggle and **−/＋ nudge buttons** flanking the clock display:
  **quick tap ±1s, long-press ±10s** (`adjustClock`, clamped ≥0, preserves running
  state by rebasing `startedAt`; not logged). There is no SET/text-entry button.
- Tied to **periods and overtime**: END HALF advances the period and resets the
  clock and team fouls; +OT adds an overtime period (OT length, fouls reset,
  possession toggles); no OT limit. These controls sit beside START/STOP in the
  header.
- **Screen-wake catch-up:** the clock is wall-clock based — while running it stores
  `startedAt` (epoch ms) and computes remaining time from elapsed real time, so it
  stays accurate after the phone screen sleeps or the tab is backgrounded. A
  `visibilitychange` listener forces an immediate re-sync on wake.
- **Dropped:** auto-stop-on-foul, auto-stop-on-timeout (timeouts are now a plain
  counter), running-clock mode, and clock alert modals.

---

## Post-Game Summary

A clean, print-friendly view reachable from END GAME:

- Final score header with period-by-period breakdown.
- **Box score tables:** both teams with the same full columns
  (PTS, FG M/A, 3PT M/A, FT M/A, OREB, DREB, REB, STL, BLK, AST, TO, FLS) — one
  box-score renderer used for each team. REB is the `oreb + dreb` total.
- Full **game log** (chronological) with period and clock time.
- **Actions:**
  - **Print** — triggers `window.print()`; a print stylesheet renders a clean
    page so the user can "Save as PDF" on iOS.
  - **Share** — `navigator.share()` when available (hidden if unsupported).
- **New Game** — clears `hoops.game` and returns to Setup. (Teams in
  `hoops.teams` are preserved.)

---

## Persistence & Offline

- Every state mutation calls `save()` → `localStorage`. Startup `load()` restores
  the last state, including an in-progress game.
- Zero network usage at any point. The entire app is the one served HTML file.
- Saved teams persist across games; the current game persists across refreshes and
  is cleared only by starting a new game.

---

## Testing (TDD)

The pure logic layer in `app.js` is developed test-first. The DOM/shell layer is
verified manually in the browser.

- **Runner:** Node's built-in test runner (`node --test`) with `node:assert`. No
  `npm install`, no Vitest, no config. Requires only Node installed on the dev
  machine.
- **Export shim:** `app.js` exposes its pure functions for the test runner without
  affecting the browser, e.g. a guarded
  `if (typeof module !== "undefined") module.exports = { ... }` at the end (or an
  equivalent UMD-style guard). The browser ignores it; `*.test.js` files
  `require()` it.
- **What gets tests (the bug-prone core):**
  - Clock math: wall-clock elapsed → remaining time, START/STOP, hitting 0:00, and
    `adjustClock` ±seconds (clamped ≥0, rebases `startedAt` when running).
  - Stat recording: each stat updates the right player fields and score; a shot
    passed `made:false` records an **attempt only** (no points) while `made:true`
    adds points + make + attempt; **the same full stat set is recordable for either
    team**. Rebounds record to `oreb`/`dreb`. (There is no `makeMode`; made/missed
    is an explicit argument.)
  - Manual ± counters: `adjustTeamFouls` and `adjustTimeouts` change their count,
    clamp at ≥0, are reversible via UNDO, and **write no log entry when the clamped
    change is zero** (likewise `adjustScore`).
  - UNDO: reverses the last log entry's exact effects — stat, score, possession,
    manual team-foul, and timeout adjustments — repeatedly.
  - Team fouls: bonus at 7, double bonus at 10, reset on new period.
  - Period transitions: END HALF and +OT reset clock, team fouls, and possession
    correctly; period labels (H1/H2/OT1…).
  - Score adjustment and possession toggle produce correct state + log entries.
  - **Team identity is independent of side (regression guard for the original
    bug):** with `config.myTeamSide === "away"`, the roster written back to
    `hoops.teams` is still `myTeam` — not the team rendered in the home/left
    position — and both teams record the full stat set. A second test asserts the
    same with `myTeamSide === "home"`, so flipping the side never moves the
    "saved team" identity to the wrong team. (The earlier assertion that the
    opponent was limited to points+fouls is removed in this revision.)
- **Not unit-tested:** rendering, event wiring, `localStorage`, `navigator.share`,
  print — verified manually on the device.

## Theming

- **Dark by default.** CSS custom properties define the palette: `:root` holds the
  dark theme (so the first paint is dark, no flash), and `[data-theme="light"]`
  overrides them. The theme is applied by setting `data-theme` on the document
  element.
- **Light mode is selectable on the Setup screen** (a Dark/Light toggle). The
  choice is a persistent preference stored in `localStorage` under `hoops.theme`
  (default `dark`), applied immediately and remembered across games.
- The game header and info bar stay dark in both themes (scoreboard look). The
  **Summary always prints light** regardless of the active theme (the `@media
  print` block forces a white background and black text) so PDFs stay clean.

## Deployment

- Commit `index.html`, `styles.css`, and `app.js` to a GitHub repo, enable GitHub
  Pages on that repo/branch.
- The page is served as-is. No build, no CI, no environment variables. Test files
  (`*.test.js`) can live in the repo; they are never loaded by the page.
