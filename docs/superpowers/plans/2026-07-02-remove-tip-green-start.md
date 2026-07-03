# Remove Tip-Off Selection; Green Start Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Who won the tip?" section from Setup (leaving the Start button as the sole way to begin a game) and give the Start button a green background matching the clock's existing START color.

**Architecture:** One task touching `app.js` (markup + wiring removal) and `styles.css` (color change).

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), no build step.

## Global Constraints

- `startGame()`'s implementation, signature, and its one remaining call site are unchanged — it already produces exactly the behavior that becomes the only path (home team possession, clock stays stopped).
- `currentMyTeamName(d)` is not modified or removed — it's still used elsewhere (History's fallback team name).
- The green used for `.startbtn` must be exactly `#16a34a` with white (`#fff`) text, matching `#clk-toggle.start`.

---

### Task 1: Remove tip-off UI/wiring, style Start button green

**Files:**
- Modify: `app.js:721-729` (`renderSetup`'s tip/Start card), `app.js:870-873` (`wireSetup`'s tip/Start wiring)
- Modify: `styles.css:215-224` (`.startbtn`)

**Interfaces:** N/A — this is the only task in the plan; pure markup/CSS/wiring, nothing here is consumed by other tasks.

- [ ] **Step 1: Remove the tip-off markup**

In `app.js`, find:

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

Replace with:

```js
    <section class="card">
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
```

- [ ] **Step 2: Remove the dead `[data-tip]` wiring and update the comment**

In `app.js`, find:

```js
  el_each('[data-tip]', (b) => (b.onclick = () => startGame(b.dataset.tip)));
  // "Start" skips the tip: possession goes to whichever team is on the home side.
  const sb = document.getElementById('btn-start-home');
  if (sb) sb.onclick = () => startGame(d.myTeamSide === 'home' ? 'my' : 'opp', false);
```

Replace with:

```js
  // Home team gets initial possession; clock stays stopped until manually started.
  const sb = document.getElementById('btn-start-home');
  if (sb) sb.onclick = () => startGame(d.myTeamSide === 'home' ? 'my' : 'opp', false);
```

- [ ] **Step 3: Style `.startbtn` green**

In `styles.css`, find:

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

Replace with:

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

- [ ] **Step 4: Verify scope**

Run: `git diff app.js styles.css`
Expected: `renderSetup`'s tip/Start card shows the tip-off heading and buttons removed; `wireSetup`'s `[data-tip]` line is gone and the comment is updated; `.startbtn`'s `background`/`color` changed to the fixed green/white values. No other function or selector differs. Confirm `startGame`'s own definition does not appear in the diff.

- [ ] **Step 5: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure markup/CSS/wiring change, count must match the current baseline.

- [ ] **Step 6: Commit**

```bash
git add app.js styles.css
git commit -m "Remove tip-off selection; style Start button green"
```

- [ ] **Step 7: Manual verification (deferred to the user)**

There is no automated test for this (pure markup/CSS/wiring, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. Setup screen no longer shows "Who won the tip?" or the two team-name buttons.
2. Tapping "Start" still begins a game with the home team's possession and the clock stopped, exactly as before.
3. The Start button is now green with white text, in both dark and light theme.
