# HoopScore (single-file basketball scorer)

Static app: `index.html` + `styles.css` + `app.js`. No build, no dependencies.

## Run locally
Open `index.html` in a browser, or serve the folder (e.g. `python -m http.server`).

## Test
`node --test`  (requires Node 17+; no `npm install`)

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
