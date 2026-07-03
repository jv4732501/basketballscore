# Remove Tip-Off Selection; Style Start Button Green

## Problem

Two changes to Setup's final card:

1. Remove the "Who won the tip?" section — the two tip-winner buttons — leaving the "Start" button as the sole way to begin a game (it already gives the home team initial possession and leaves the clock stopped, exactly as it does today).
2. Give the Start button a green background, matching the exact green (`#16a34a`) already used for the clock's own "START" state (`#clk-toggle.start`), rather than introducing a new color.

## Scope

- `app.js`: remove the `<h2>Who won the tip?</h2>` heading and `<div class="tip-row">...</div>` (the two tip buttons) from `renderSetup`; remove the now-dead `el_each('[data-tip]', ...)` wiring line in `wireSetup`; tighten the comment above the Start button's handler (currently "Start skips the tip: possession goes to whichever team is on the home side", which will no longer make sense once there's no tip option to skip).
- `styles.css`: `.startbtn` gains `background: #16a34a; color: #fff;` (removing its current theme-following `background: var(--btn-bg); color: var(--btn-text);`, since it becomes a fixed-color button like `#clk-toggle.start`, not a theme-following one).
- Out of scope: `startGame()`'s implementation, signature, and its one remaining call site (`sb.onclick = () => startGame(d.myTeamSide === 'home' ? 'my' : 'opp', false)`) are unchanged — it already produces exactly the behavior that will now be the only path.

## Approach

### Markup (`renderSetup`)

Current:
```js
    <section class="card">
      <h2>Who won the tip?</h2>
      <div class="tip-row">
        <button class="tip" data-tip="my">${esc(currentMyTeamName(d) || 'My Team')}</button>
        <button class="tip" data-tip="opp">${esc(d.oppName || 'Opponent')}</button>
      </div>
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
```

Becomes:
```js
    <section class="card">
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
```

### Wiring (`wireSetup`)

Current:
```js
  el_each('[data-tip]', (b) => (b.onclick = () => startGame(b.dataset.tip)));
  // "Start" skips the tip: possession goes to whichever team is on the home side.
  const sb = document.getElementById('btn-start-home');
  if (sb) sb.onclick = () => startGame(d.myTeamSide === 'home' ? 'my' : 'opp', false);
```

Becomes:
```js
  // Home team gets initial possession; clock stays stopped until manually started.
  const sb = document.getElementById('btn-start-home');
  if (sb) sb.onclick = () => startGame(d.myTeamSide === 'home' ? 'my' : 'opp', false);
```

`currentMyTeamName(d)` (previously also used by the removed tip button's label) is still used elsewhere (the History fallback team name at a different line) — it is not modified or removed.

### CSS

Current:
```css
.startbtn {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  font-weight: 600;
  background: var(--btn-bg);
  color: var(--btn-text);
  border: 1px solid var(--border);
  border-radius: 8px;
}
```

Becomes:
```css
.startbtn {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  font-weight: 600;
  background: #16a34a;
  color: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
}
```

## Testing

Pure markup/CSS/wiring change — no logic touched, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Setup screen no longer shows "Who won the tip?" or the two team-name buttons.
2. Tapping "Start" still begins a game with the home team's possession and the clock stopped, exactly as before.
3. The Start button is now green with white text, in both dark and light theme.
