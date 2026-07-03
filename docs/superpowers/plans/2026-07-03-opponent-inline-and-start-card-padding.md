# Opponent Field Inline Layout + Start Card Padding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Opponent label and its input on one line, and reduce padding on just the Start button's card.

**Architecture:** Two markup changes (new classes on two existing elements) and two new CSS rules.

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), no build step.

## Global Constraints

- No other `.card label`/`.card input` combination changes — e.g. "Team name" in the Team Editor keeps its current stacked layout.
- No other card's padding changes — only the Start button's card.

---

### Task 1: Opponent inline row + Start card padding

**Files:**
- Modify: `app.js` (Opponent `<label>`, Start button's `<section class="card">`)
- Modify: `styles.css` (add `.opp-row` after `.card input, .card select`; add `.start-card` after `.card`)

**Interfaces:** N/A — this is the only task in the plan; pure markup/CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Add `opp-row` class to the Opponent label**

In `app.js`, find:

```js
      <label>Opponent <input id="opp-name" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
```

Replace with:

```js
      <label class="opp-row">Opponent <input id="opp-name" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
```

- [ ] **Step 2: Add `start-card` class to the Start button's section**

In `app.js`, find:

```js
    <section class="card">
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
```

Replace with:

```js
    <section class="card start-card">
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
```

- [ ] **Step 3: Add the `.opp-row` CSS**

In `styles.css`, find:

```css
.card input,
.card select {
  width: 100%;
  padding: 10px;
  font-size: 1rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
}
```

Add immediately after it:

```css
.card input,
.card select {
  width: 100%;
  padding: 10px;
  font-size: 1rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
}

.opp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.opp-row input {
  width: auto;
  flex: 1;
}
```

- [ ] **Step 4: Add the `.start-card` CSS**

In `styles.css`, find:

```css
.card {
  background: var(--surface);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
```

Add immediately after it:

```css
.card {
  background: var(--surface);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.start-card {
  padding: 6px;
}
```

- [ ] **Step 5: Verify scope**

Run: `git diff app.js styles.css`
Expected: `app.js` shows only the two class additions (`opp-row`, `start-card`); `styles.css` shows the two new rules added, with `.card` and `.card input, .card select` themselves unchanged. No other selector or markup differs.

- [ ] **Step 6: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure markup/CSS change, count must match the current baseline.

- [ ] **Step 7: Commit**

```bash
git add app.js styles.css
git commit -m "Put Opponent field inline; reduce Start card padding"
```

- [ ] **Step 8: Manual verification (deferred to the user)**

There is no automated test for this (pure markup/CSS, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. "Opponent" label and its input are on one line.
2. Other label/input pairs elsewhere (Team name in the Team Editor, Half length, etc.) are unchanged.
3. The Start button's card has visibly less padding than the other cards on the Setup screen.
