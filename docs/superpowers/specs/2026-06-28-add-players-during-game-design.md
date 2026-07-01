# Add Players During Game — Design Spec

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Extends:** `2026-06-26-single-file-basketball-scorer-design.md` (core app spec). All
core constraints still hold (three static files, no build/deps, `app.js`
require()-able with no DOM, pure logic TDD'd + shell verified manually, identity-
keyed state, both teams use the full stat set).

## Goal

Let the user start a game knowing only the team names and **add players to either
team during gameplay** as they check in. Players added to the user's own team also
persist into the saved team for next time.

---

## 1. Setup: start with just team names

`startGame`'s validation currently requires a name **and at least one player** on
each team. Relax it so the only requirement is the **two team names**
(`myName` and the opponent name). Starting with empty rosters is allowed — the
tip-off begins the game as usual.

- A newly created "my" team is still saved to `hoops.teams` (with whatever roster
  exists at start, possibly empty).
- No other Setup change.

---

## 2. Mid-game "+ Add" (both teams)

Each team's player column on the Game screen gets a **"+ Add"** button below the
player list. Tapping it reveals a small inline mini-form in that column — a
jersey-number field, an optional name field, an **Add** button, and a way to
close/cancel (mirroring Setup's quick-add, stacked to fit the narrow column).

- Adding creates a player with a generated id and the **full zeroed stat set**
  (same shape as every other player), appended to that team. The player appears
  immediately and is tappable for stat entry.
- Works for **both** teams.
- A blank/non-numeric jersey is ignored (no-op), same as Setup's quick-add.
- Adding a player is a **roster change, not a scored event**: it is not written to
  the game log and is not reversed by UNDO.
- Implementation note: the columns are ~23% wide; the inline form stacks its inputs
  vertically. (If too cramped in practice, a future tweak could move it to a
  popover anchored to the button — same trigger; out of scope here.)

---

## 3. Persisting additions to the saved team

When a player is added to the **user's own team** mid-game, it is also written into
that team's entry in `hoops.teams` (matched by `myTeam.id`), as `{ id, num, name }`,
and `saveTeams()` is called — so the saved roster grows over time. If no matching
saved team exists (e.g. it was deleted), the persist step is silently skipped.

**Opponent** additions are game-only — the opponent is not a saved team, so nothing
is persisted for it.

---

## 4. Logic & testing

- **Pure function (TDD'd):** `addPlayerToGame(game, team, { id, num, name }) → game`
  — returns a clone with `{ id, num, name, ...emptyMyStats() }` appended to
  `team === "my" ? myTeam : oppTeam`; the other team is untouched and the input
  game is not mutated.
- The shell generates the id (`makeLocalId`), calls `addPlayerToGame` through the
  existing `commit` path, then separately persists to the saved team for `my`.
- **Tests:** `addPlayerToGame` appends to the named team with the full zeroed stat
  shape; the opponent roster is unchanged; the input game is not mutated.
- **Not unit-tested (shell, browser-verified):** the relaxed Setup validation, the
  "+ Add" button / inline form, and the persist-to-saved-team step.

---

## Out of scope

- Removing players mid-game (add-only; roster editing lives on the Teams page).
- Substitutions / on-court vs bench (still no subs).
