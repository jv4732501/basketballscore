# Home Navigation, Teams & Game Management — Design Spec

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Extends:** `2026-06-26-single-file-basketball-scorer-design.md` (the core app spec).
This cycle adds two management screens and the navigation to reach them. All the
core constraints from that spec still hold (three static files, no build/deps,
`app.js` require()-able with no DOM, pure logic TDD'd + shell verified manually,
dark theme, identity-keyed state).

## Goal

Add a **Teams** management page and a **Game history** page, reachable from a home
tab bar, so the user can edit/delete saved teams and revisit/re-open/delete past
games. This introduces persistence of *finished* games (today only one game is
kept at a time).

---

## 1. Home navigation

Today `render()` routes purely off `game.screen` (game / summary / setup). This
cycle adds an app-level **home view** for when there is no active game.

- A module-level `homeView` of `"setup" | "teams" | "history"` (default
  `"setup"`), held in shell state (like `setupDraft`), not persisted.
- **`render()` routing becomes:**
  - `game` with `screen === "game"` → Game screen (no tabs).
  - `game` with `screen === "summary"` → Summary screen (no tabs).
  - otherwise → **Home**: a top **tab bar** (`New Game · Teams · History`) plus the
    active tab's content (Setup form / Teams page / History page).
- The tab bar is shown **only on the home screens** — hidden during a game and on
  the summary. Tapping a tab sets `homeView` and re-renders. "New Game" is the
  existing Setup view (including its resume banner).

---

## 2. Data model additions

- **`game.id`** — a generated id assigned at New Game (in `startGame`, shell),
  used to identify a game within history (upsert / re-open / delete).
- **`game.date`** — an epoch-ms timestamp stamped by the shell in `startGame`
  (logic stays pure; the date is set after `newGame` returns). Used for the
  history list display.
- **`hoops.history`** — a new `localStorage` key holding an **array of finished
  game objects** (full game state, so re-open can restore everything). Loaded into
  `state.history` on startup; saved whenever it changes.

### Pure functions (TDD'd)

- `upsertHistory(history, game) → history` — returns a new array with `game`
  replacing any existing entry of the same `id`, else appended. (Keep all.)
- `removeFromHistory(history, id) → history` — returns a new array without the
  entry of that `id`.
- `reopenGame(game) → game` — returns a clone with `screen: "game"`, the trailing
  `end_game` log entry removed (if present), and the last `periodScores` snapshot
  popped — so the game resumes in its final period and a subsequent END GAME
  re-snapshots correctly instead of double-counting.

---

## 3. Teams page (Teams tab)

- Lists saved teams from `state.teams`. Each row: team **name** and **player
  count**, with **Edit** and **Delete** buttons.
- **Delete** removes the team from `hoops.teams` after a confirm.
- **Edit** opens a team-detail editor: rename the team and add / remove / edit
  players (jersey number + optional name), reusing the roster-editing pattern
  already in Setup. Saving persists to `hoops.teams`.
- The Setup team picker is unchanged; this page manages the saved list.
- Empty state when there are no saved teams.

---

## 4. Game history (History tab) + saving

- **Saving:** the **END GAME** shell handler, after `endGame(...)`, upserts the
  finished game into `state.history` by `id` and persists `hoops.history`. Keep
  all games. Re-ending a re-opened game updates its existing entry (no duplicate).
- **History list:** finished games shown **newest-first**, each row showing the
  **date**, **"MyTeam vs Opponent"**, the **final score**, and a **W/L** marker
  for the user's team, with **Open** and **Delete** buttons.
  - **Open** → `reopenGame` the entry, load it into `state.game`, persist, and
    render the Game screen so scoring can resume. **Guard:** if `state.game` is a
    *different* in-progress game (`screen === "game"`, different `id`), confirm
    before replacing it (the in-progress game is not in history and would be lost).
    Re-opening the same game already in `state.game` just flips to the game screen.
  - **Delete** → `removeFromHistory` after a confirm; persist.
- **No separate read-only view** (per the chosen design): to reprint a past game,
  Open it then END GAME, which returns to the printable summary.
- Empty state when there is no history.

---

## 5. Testing

Pure logic is developed test-first with `node --test`:

- `upsertHistory`: appends a new game; replaces an existing entry with the same
  `id` (length unchanged, contents updated); preserves order/other entries.
- `removeFromHistory`: removes the matching `id`; no-op for an unknown id.
- `reopenGame`: sets `screen` to `"game"`; removes a trailing `end_game` log entry;
  pops the last `periodScores` snapshot; a game ended → reopened → ended again has
  the correct number of period snapshots (no double-count).

Not unit-tested (shell, verified in the browser): the tab bar/home routing, the
Teams page list/editor, the History list, Open/Delete wiring, and the
confirm-before-replace guard.

---

## Out of scope (this cycle)

- Season aggregates, charts, player drill-downs (still dropped).
- Cloud sync / sharing links.
- Swipe-to-delete gestures (explicit Edit/Delete buttons chosen instead).
