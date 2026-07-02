# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HoopScore — a single-page basketball scoring app. Static site: `index.html` + `styles.css` + `app.js`. **No build step, no dependencies, no `package.json`, no `npm install`.** Every tool used here (Node's test runner, VS Code's TypeScript language service, Prettier) is invoked without adding a permanent dependency to the project — preserve this when making changes.

## Commands

- **Run the app:** open `index.html` in a browser, or serve the folder (`python -m http.server`).
- **Run tests:** `node --test` (requires Node 17+). Runs `logic.test.js`, which `require()`s `app.js` directly — no test framework installed.
- **Run a single test:** `node --test --test-name-pattern="<name substring>"`.
- **Type-check:** automatic in VS Code via `jsconfig.json` (Problems panel, no install needed). One-off terminal run: `npx tsc --noEmit -p jsconfig.json` (downloads TypeScript temporarily; requires network).
  - Known false positives, not real bugs (see `.superpowers/sdd/progress.md` Cycle 10): `app.js`'s `$(id)` DOM helper returns generic `HTMLElement`/`Element` so `.value`/`.click()` accesses on it are flagged; `logic.test.js`'s `require('node:test')`/`require('node:assert')` trigger a hardcoded "install `@types/node`" diagnostic that ambient declarations can't suppress.
- **Format:** automatic in VS Code via `.vscode/settings.json`, using the Prettier extension (`esbenp.prettier-vscode`) for `.js`/`.css`/`.html`. **After editing `app.js`, `styles.css`, `logic.test.js`, or `index.html` directly (i.e. not through VS Code's save-triggered format, which agents bypass), run `npx prettier --write app.js styles.css logic.test.js index.html`** to keep the file consistent with the rest of the codebase (2-space indent, single quotes, semicolons, ~100-char line wrap). This downloads Prettier temporarily via `npx`; it is not a permanent install.

## Architecture

Everything lives in `app.js` (one file, ~1700 lines), organized top-to-bottom as: pure game-logic functions → persistence/state → render functions → event-wiring functions. `index.html` has one `<script src="app.js">`; the same file is `require()`d directly by `logic.test.js` for tests, guarded by `if (typeof module !== 'undefined' && module.exports) { module.exports = {...} }` near the top of the "shell" section — anything the tests need to reach must be added to that export list.

**State & rendering.** A single module-level `let state = { teams, game, theme, history }` holds everything, persisted to `localStorage` (keys in `KEYS`, serialized with `serialize`/`deserialize`). There is no diffing/virtual DOM: every state change ends in a full `innerHTML` rewrite of the active section (`renderSetup`, `renderGame`, `renderTeams`, `renderHistory`, `renderSummary`), which destroys and recreates all its DOM nodes. Because of this, **event handlers must be re-wired after every render** — each `renderX()` is paired with a `wireX()` called right after, and any per-click visual effect (see `flashKey`/`flashClass` in `renderControls`) has to be a "consume once" flag baked into the render, not a CSS `:active` state or a JS timer, since the DOM node it would animate gets thrown away immediately.

**Screens.** `render()` (the central dispatcher) looks at `state.game.screen` (`'game'` | `'summary'` | absent) and `homeView` (`'setup'` | `'teams'` | `'history'`) to decide which of the six top-level sections (`ALL_SECTIONS`) to show via `showOnly(...)`, which toggles the `hidden` attribute. Mutating game state always goes through `commit(producer)`, which calls `producer(state.game, Date.now())`, saves, and re-renders — this is the only path that should mutate `state.game`.

**Game logic is pure.** Functions like `recordStat`, `startClock`, `adjustScore`, `endHalf`, `undo` etc. take `(game, ..., nowMs)` and return a new game object (via `clone`, which is `structuredClone`) rather than mutating in place — this is what makes them unit-testable via `require()` without a DOM. `nowMs` is always passed in explicitly (never read from `Date.now()` inside these functions) so tests can control time.

**Clock.** Time is tracked as `{ remainingSec, running, startedAt }`, not a live countdown — `clockRemaining(clock, nowMs)` computes the current value from `startedAt`. This means the clock survives tab backgrounding/lock-screen without drift; `startTick()`/`stopTick()` just poll every 250ms to update the on-screen display and auto-stop at 0:00.

**Undo.** Every mutating action pushes a log entry with a `rev` object describing how to reverse it (`{ kind: 'stat'|'score'|'possession'|'timeoutadj'|'teamfoul', ... }`); `undo()` pops the last log entry and applies the inverse based on `rev.kind`. When adding a new mutating action, give it a `rev` shape and a branch in `undo()`, or it won't be undoable.

**Theming.** Dark is the default; `[data-theme="light"]` in `styles.css` overrides the same set of CSS custom properties (`--bg`, `--surface`, `--btn-bg`, etc.) that everything else references — never hardcode a color in a component rule, add/override a variable instead.

**Long-press interactions.** Shot/foul buttons distinguish tap vs. long-press (`attachPressHandlers`) to open an in-DOM popover menu (`openPopover`/`openStatMenu`) for modifiers (e.g. shooting foul type) instead of navigating away; player buttons have their own long-press menu (`openPlayerMenu`) for substitutions and an activity dialog.

## Workflow

Design/implementation history for past changes is tracked under `docs/superpowers/specs/` and `docs/superpowers/plans/`, with a cumulative cycle-by-cycle ledger in `.superpowers/sdd/progress.md` (git-ignored, local-only) — check it for the reasoning behind past decisions before re-deriving them.
