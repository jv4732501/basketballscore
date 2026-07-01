# Miss Button — Design Spec

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Extends:** `2026-06-26-single-file-basketball-scorer-design.md`. All core
constraints hold (three static files, no build/deps, `app.js` require()-able with
no DOM, identity-keyed state). This is **Feature 2 of two** the user raised; the
player-menu / substitutions / minutes feature is a separate later cycle.

## Goal

Add a fast way to record a missed shot via a dedicated **MISS** button (quick taps
instead of a 500ms long-press), since youth games miss often. The long-press shot
menu (Miss + modifiers) stays as a second path. This is a **shell-only** change —
`recordStat` already accepts a `made` flag, so there is no new game logic.

---

## Behavior

- A new **MISS** button. Tapping it toggles a shell flag `missArm`; while armed the
  button is highlighted **red**.
- While `missArm` is set, the next tap on a shot button (**2PT / 3PT / FT**) records
  that shot as a **miss** (`made:false`) and clears `missArm` (auto-disarm). A
  made shot is still a single tap (shot button, no arming).
- Tapping MISS again disarms it. A non-shot stat tap does not consume the arm (it
  waits for a shot); recording a shot only consumes the arm when a player is
  selected (so an accidental tap with no player selected keeps it armed).
- The **long-press menu is unchanged** (still offers Miss + the shot modifiers), so
  both miss paths work.
- `missArm` is transient shell UI state — not part of the game object, not
  persisted, and reset to `false` on game-entry transitions (`startGame`,
  `openHistoryGame`), consistent with `addOpen`.

---

## Layout

The center controls grid gains the MISS button, which makes **11 buttons + UNDO =
12 cells** in the 3-column grid — so **UNDO stops spanning two cells and becomes a
normal single button**. Button order (chosen):

```
2PT    3PT    FT
MISS   OREB   DREB
STL    BLK    AST
TOVR   FOUL   UNDO
```

- The `.grid .undo { grid-column: span 2 }` rule is removed.
- MISS uses the standard grid-button style when unarmed and a red `armed` style when
  `missArm` is set.

---

## Testing

- **No new unit tests / no logic change** — `recordStat(..., { made:false })` is the
  existing, already-tested path; the suite stays green (52/52).
- **Shell, browser-verified:** the MISS button arms (turns red) and the next shot
  records as a miss (attempt only, no points) and disarms; tapping MISS again
  disarms; long-press still opens the shot menu; the grid renders in the new order
  with UNDO as a single cell.

---

## Out of scope (separate next cycle)

- Long-press player menu, Player activity dialog, Sub in/out, on-court (green)
  status, and minutes-played in the report — these are Feature 1, designed/built
  next.
