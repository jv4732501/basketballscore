# Player Menu, Substitutions & Minutes — Design Spec

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Extends:** `2026-06-26-single-file-basketball-scorer-design.md`. Core constraints
hold (three static files, no build/deps, `app.js` require()-able with no DOM, pure
logic TDD'd + shell verified manually, identity-keyed state, both teams symmetric).

## Goal

Long-press a player to open a menu offering **Player Activity** (that player's game
log) and **Sub In / Sub Out**. On-court players show their number in **green**, and
the post-game box score gains a **MIN** (minutes played) column, computed from
game-clock time on court.

This reintroduces substitutions and minutes-played (dropped in v1.0) in a lighter,
flat-roster form: no starter selection, no 5-on-court enforcement — on-court is
informational and drives only the minutes calculation.

---

## 1. Player long-press menu

Player tiles keep **quick tap = select** (unchanged). **Long-press (500ms)** opens
an in-DOM popover anchored to the tile (reusing the existing backdrop/popover
pattern from the shot menu), with two items:

- **Activity** → opens the Player Activity dialog (§4).
- **Sub In** when the player is on the bench, or **Sub Out** when on court — a
  single contextual item reflecting current status.

A new press-handler is attached to player tiles (mirroring `attachPressHandlers`
for stat buttons): quick tap selects; long-press opens the menu; the post-long-press
click is suppressed.

---

## 2. On-court state + green number

Each player carries `onCourt` (default **false** — everyone starts on the bench).
On the tile, the `#number` renders **green** when `onCourt` is true. Sub In sets it
true; Sub Out sets it false. On-court status is **informational only** — it never
restricts stat entry (any player, bench or court, can be selected and recorded).

---

## 3. Substitutions & minutes model

**Minutes = game-clock time that advanced while the player was on court.** Because
the game clock only moves while running, this naturally excludes clock-stopped time;
it is computed as `clockAtSubIn − clockAtSubOut` per on-court interval.

Each player carries:
- `inClock` — the clock remaining (seconds) when last subbed in, within the current
  period; `null` while on the bench.
- `courtSecs` — accumulated on-court game-seconds.

Pure-logic behavior:
- **`subIn(game, team, playerId, nowMs)`** — `onCourt=true`, `inClock = clockRemaining(clock, nowMs)`; appends a `sub_in` log entry (`#<num> <name> subs in`). No-op if already on court.
- **`subOut(game, team, playerId, nowMs)`** — if on court: `courtSecs += inClock − clockRemaining(clock, nowMs)`; `onCourt=false`; `inClock=null`; appends a `sub_out` log entry. No-op if already on the bench.
- **Period transitions (`endHalf`, `addOvertime`)** — after the clock is stopped for
  the transition, for every on-court player (both teams) **close** the interval
  (`courtSecs += inClock − clock.remainingSec`); then after the clock is reset to the
  new period's full length, **reopen** it (`inClock = clock.remainingSec`, the full
  value) since the player remains on court.
- **`endGame`** — after the clock is stopped, **close** every on-court player's
  interval (`courtSecs += inClock − clock.remainingSec`); `courtSecs` is then final
  for the report. (No reopen.)

**Subs are logged but not undoable.** A `sub_in`/`sub_out` entry carries no `rev`,
so UNDO does not reverse it — consistent with how the log already treats non-stat
entries (roster/lifecycle changes).

Minutes come from the incrementally-accumulated `courtSecs`, not from re-parsing the
log.

---

## 4. Player Activity dialog

A centered modal dismissed by a backdrop tap, titled with the player
(`#<num> <initials>`), listing **all** of that player's events — filtered from
`game.log` by `playerId`, newest first, in a scrollable area — each row showing the
clock time, period label, and description (shots, rebounds, fouls, subs). A "No
activity yet" line when empty. A Close button (and backdrop) dismiss it.

---

## 5. Box score MIN column

Each team's post-game box-score table gains a **MIN** column (after FLS), showing
minutes to one decimal (e.g. `12.5`) via a `fmtMinutes(secs) → (secs/60).toFixed(1)`
helper, from each player's `courtSecs`.

---

## 6. Data model & testing

- **Player shape** gains `onCourt:false`, `inClock:null`, `courtSecs:0`, applied
  wherever players are created (`newGame` and `addPlayerToGame`).
- **Pure functions (TDD'd):** `subIn`, `subOut`, `fmtMinutes`, plus the close/reopen
  additions to `endHalf` / `addOvertime` / `endGame`.
- **Tests:**
  - `subIn` sets `onCourt`/`inClock` and logs; `subOut` accrues `courtSecs =
    clockIn − clockOut`, clears on-court, logs; both are no-ops in the wrong state.
  - A player subbed in during H1, carried across `endHalf` into H2, then subbed out
    accrues the correct total across the boundary (close at H1 end + reopen at H2
    full clock).
  - A player still on court at `endGame` has their final interval closed (correct
    `courtSecs`).
  - `fmtMinutes` formats seconds to one-decimal minutes.
- **Not unit-tested (shell, browser-verified):** the long-press player menu, the
  green on-court number, the Activity dialog, and the MIN column rendering.

---

## Out of scope

- Starter pre-selection and any 5-on-court enforcement (on-court is informational).
- Undoing a substitution.
- Per-period minutes breakdown (single total per player).
