# HoopScore (single-file basketball scorer)

Static app: `index.html` + `styles.css` + `app.js`. No build, no dependencies.

## Run locally
Open `index.html` in a browser, or serve the folder (e.g. `python -m http.server`).

## Test
`node --test`  (requires Node 17+; no `npm install`)

## Linting
Type-checking runs automatically in VS Code via `jsconfig.json` — open the project and check the Problems panel, no install needed.
Optional one-off terminal check: `npx tsc --noEmit -p jsconfig.json` (downloads TypeScript temporarily; requires network, not a permanent install).

Known false positives (not real bugs, left as-is to avoid scope creep — see `.superpowers/sdd/progress.md` Cycle 10 for details):
- ~10 "Property 'value'/'click' does not exist" errors where `app.js`'s `$(id)` DOM helper returns a generic `HTMLElement`/`Element` instead of the specific input/button subtype.
- 2 "Cannot find name 'node:test'"/`'node:assert'` errors in `logic.test.js` — a hardcoded TypeScript diagnostic for `require()`-ing Node builtins without `@types/node`, which ambient module declarations can't suppress.

## Formatting
Format-on-save is automatic in VS Code via `.vscode/settings.json` — built-in formatters, no extension needed.
Optional one-off terminal check/fix: `npx prettier --check app.js styles.css logic.test.js` / `npx prettier --write app.js styles.css logic.test.js` (downloads temporarily; requires network, not a permanent install).

Known gap: VS Code's built-in formatter is lighter-touch than Prettier — it fixes indentation and local spacing, but won't wrap long lines, won't normalize quote style, and won't insert missing semicolons the way Prettier does. So a freshly-typed line can look visibly different from the rest of the file until you re-run the `npx prettier --write` command above. If this friction gets old, installing the "Prettier - Code formatter" VS Code extension and setting it as the default formatter for `[javascript]`/`[css]` in `.vscode/settings.json` would make format-on-save match Prettier's style exactly.

## Deploy
Commit the three files to a GitHub repo and enable GitHub Pages on the branch.

## Manual QA checklist
- [ ] First run: create a team, add opponent, tap tip → game starts, clock runs.
- [ ] Scoring (2/3/FT make+miss), make/miss auto-reset, detailed stats for my team.
- [ ] Opponent limited to points + fouls.
- [ ] Team fouls bonus (7) / double bonus (10) badges.
- [ ] Clock: start/stop, SET, lock-screen catch-up, auto-stop at 0:00, timeout stops clock.
- [ ] Possession toggle; undo; END HALF; +OT; END GAME.
- [ ] "My team is Away": my team renders right, still gets detailed controls + saved correctly.
- [ ] Summary: final score, period table, box scores, log; Print shows only summary; New Game resets.
- [ ] Reload mid-game → resume banner → Resume restores exact state; Discard clears it.
