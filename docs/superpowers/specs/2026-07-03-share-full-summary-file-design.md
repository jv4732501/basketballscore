# Share a Full Game-Summary Text File Instead of a One-Line Blurb

## Problem

On iPhone, tapping "Share" on the Final summary screen and choosing "Save to Files" saves a file only a few bytes long, containing just one team's name. iOS's Share Sheet, when given plain `text` (no actual file), converts that text into a throwaway `.txt` file when "Save to Files" is picked — and the current `navigator.share({ title, text })` call only sends a one-line score recap (`"TeamA 52 – 48 TeamB"`), so that's all that ends up saved.

## Root Cause

`renderSummary()`'s Share handler:
```js
share.onclick = () =>
  navigator
    .share({
      title: `${g.myTeam.name} vs ${g.oppTeam.name}`,
      text: `${g.myTeam.name} ${g.score.my} – ${g.score.opp} ${g.oppTeam.name}`,
    })
    .catch(() => {});
```
never passes an actual `File`/`Blob` — only `title`/`text` strings. This is fine for sharing to Messages/social apps (which just want a short line), but "Save to Files" has nothing real to save, so it materializes the text itself as a tiny file.

## Scope Decision

The user asked whether Share could produce a PDF. Since this project deliberately has no dependencies/build step, and hand-rolling PDF generation without a library would be complex and fragile, we're not building PDF export here. The existing "Print" button already provides a PDF path for free: on iOS, the print preview's own share sheet has a native "Save to Files"/"Save as PDF" option, and it now uses the light-theme print styling added in Cycle 36 — so PDF needs are already covered without new code.

This task instead fixes "Share" to produce an actual text **file** (via the Web Share API's `files` option) containing the full game summary — title, final score, scoring-by-period, both teams' full box scores, and the complete game log — mirroring everything already shown on the Final summary screen, not just the current one-line recap. This is a superset of "just a text file, good enough" from the user's answer, and matches the on-screen summary 1:1 so nothing is silently left out of the saved record.

## Approach

**New function: `buildSummaryText(g, leftTeam, rightTeam, deltas)`** in `app.js`, called from `renderSummary()`'s Share handler (which already computes `g`, `leftTeam`, `rightTeam`, `deltas` for the on-screen HTML). Returns a plain-text string:

```
<MyTeam> vs <OppTeam>

FINAL: <LeftTeam> <leftScore> – <rightScore> <RightTeam>

Scoring by period
<PeriodLabel1> <PeriodLabel2> ... Total
<LeftTeam>: <d1> <d2> ... <leftScore>
<RightTeam>: <d1> <d2> ... <rightScore>

<LeftTeamName> box score
#<num> <name>: <pts> PTS, <fgm>/<fga> FG, <tpm>/<tpa> 3PT, <ftm>/<fta> FT, <oreb> OREB, <dreb> DREB, <reb> REB, <stl> STL, <blk> BLK, <ast> AST, <to> TO, <pf> FLS, <min> MIN, <eff> EFF
... (one line per player, sorted by number, same as boxScore())
TOTAL: <same fields, summed>

<RightTeamName> box score
... (same shape)

Game log
<clockText> <periodLabel> — <detail>
... (one line per log entry, same order as on screen)
```

Uses the same underlying stat fields/sums `boxScore()` already computes (`pts`, `fgm`/`fga`, `tpm`/`tpa`, `ftm`/`fta`, `oreb`, `dreb`, `stl`, `blk`, `ast`, `to`, `pf`, `courtSecs` via `fmtMinutes`, `playerEff`) — `buildSummaryText` recomputes them independently as plain-text lines rather than reusing `boxScore()`'s HTML-table output, since HTML and plain text need different shapes; this duplicates the per-player summation logic already present in `boxScore()`, consistent with this codebase's existing convention of each render/format function inlining its own computations rather than sharing a data-layer abstraction.

**Share handler becomes:**
```js
share.onclick = () => {
  const text = buildSummaryText(g, leftTeam, rightTeam, deltas);
  const filename = `${g.myTeam.name}-vs-${g.oppTeam.name}`.replace(/[^a-z0-9-]+/gi, '-') + '.txt';
  const file = new File([text], filename, { type: 'text/plain' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: `${g.myTeam.name} vs ${g.oppTeam.name}` }).catch(() => {});
  } else {
    navigator.share({ title: `${g.myTeam.name} vs ${g.oppTeam.name}`, text }).catch(() => {});
  }
};
```
`navigator.canShare({ files })` is the standard feature-detection for file sharing (supported on iOS Safari 15+; not all `navigator.share`-capable browsers support files) — if unsupported, falls back to today's text-only share (now using the *full* summary text instead of the one-liner, so even the fallback path is richer than before).

## Testing

`buildSummaryText` is a pure function (string in data, string out) — testable via `require('./app.js')`, unlike the DOM-driven Share handler itself. Add it to `module.exports` and write `logic.test.js` cases covering: correct final score/team names in the header, correct per-period deltas, correct per-player and total box-score lines for a small fixture game, and correct game-log lines. The Share button's click wiring itself (file construction, `canShare`/fallback branching) has no automated coverage — DOM-driven, matches this codebase's existing precedent — and is deferred to manual verification.

Manual verification (deferred to the user, since this sandbox has no browser):
1. On iPhone, finish a game, tap Share, choose "Save to Files" — the saved file should be a `.txt` file containing the full summary (title, score, period table, both box scores, game log), not a few bytes.
2. Sharing to Messages/another app should still work and show a preview of a text file (not raw text pasted into the message body), since it's now shared as a `File`.
3. On a browser/OS where `navigator.canShare({files})` isn't supported, Share should still fall back to sharing the full summary as plain `text` (not just the old one-liner).
