# Box Score: Team Totals + EFF Column — Design Spec

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Extends:** `2026-06-26-single-file-basketball-scorer-design.md`. Core constraints
hold (three static files, no build/deps, `app.js` require()-able with no DOM, pure
logic TDD'd + shell verified manually).

## Goal

Add a per-player **EFF** (efficiency) column and a **TOTAL** row to each team's
post-game box score.

## EFF (efficiency)

A pure function `playerEff(p) → number`:

```
EFF = pts + (oreb + dreb) + ast + stl + blk
      − ((fga + tpa) − (fgm + tpm))   // missed field goals (2PT + 3PT)
      − (fta − ftm)                   // missed free throws
      − to                            // turnovers (the per-player stat, NOT timeouts)
```

- `to` is the player's turnover count (the TOVR button), a per-player field.
  Timeouts are a separate team-level count and are not part of EFF.
- EFF may be negative.
- Rendered as a new **EFF** column appended after **MIN** in the box-score table.

## TOTAL row

Each team's box-score table gains a bottom **TOTAL** row summing every column,
computed by reducing over the team's players in `boxScore`:

- **PTS** = Σ pts
- **FG** = `fmtShot(Σ(fgm+tpm), Σ(fga+tpa))`
- **3PT** = `fmtShot(Σ tpm, Σ tpa)`
- **FT** = `fmtShot(Σ ftm, Σ fta)`
- **OREB** = Σ oreb, **DREB** = Σ dreb, **REB** = Σ(oreb+dreb)
- **STL** = Σ stl, **BLK** = Σ blk, **AST** = Σ ast, **TO** = Σ to, **FLS** = Σ pf
- **MIN** = `fmtMinutes(Σ courtSecs)`
- **EFF** = Σ `playerEff(p)` (team efficiency)

The first cell of the row reads `TOTAL`.

## Scope & testing

- `boxScore` is the shared renderer, so both teams get the EFF column and the
  TOTAL row automatically.
- **Pure (TDD'd):** `playerEff` — verified on a known player with mixed
  makes/misses (including a case that yields a negative result), and exported.
- **Shell, browser-verified:** the EFF column cell, the TOTAL row, and the totals
  reduce in `boxScore` (header column count stays equal to per-row cell count;
  the TOTAL row has the same number of cells).

## Out of scope

- EFF anywhere other than the post-game box score (no live in-game EFF).
- Per-period totals.
