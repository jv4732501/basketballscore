# My Team Row Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Setup screen's "My Team" heading and team dropdown on one line, removing the "Saved team" label text.

**Architecture:** One markup change in `renderSetup` and one CSS addition in `styles.css`.

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), no build step.

## Global Constraints

- No change to the dropdown's options/behavior, the active-roster checklist, or any other card on the Setup screen.
- The zero-teams fallback branch keeps its own `<h2>My Team</h2>` heading.

---

### Task 1: Restructure the "My Team" card markup and add row CSS

**Files:**
- Modify: `app.js:670-687` (`renderSetup`'s "My Team" card)
- Modify: `styles.css:108-111` (add new rules after `.card h2`)

**Interfaces:** N/A — this is the only task in the plan; pure markup/CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Restructure the "My Team" card markup**

In `app.js`, find:

```js
    <section class="card">
      <h2>My Team</h2>
      ${
        state.teams.length
          ? `
        <label>Saved team
          <select id="my-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>
        <ul class="roster">${renderActiveRoster(d)}</ul>`
          : `<p class="muted">No teams yet — create one from the Teams tab.</p>`
      }
    </section>
```

Replace with:

```js
    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>My Team</h2>
          <select id="my-team-select">
            ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.myTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <ul class="roster">${renderActiveRoster(d)}</ul>`
          : `<h2>My Team</h2><p class="muted">No teams yet — create one from the Teams tab.</p>`
      }
    </section>
```

- [ ] **Step 2: Add the `.my-team-row` CSS**

In `styles.css`, find:

```css
.card h2 {
  margin: 0 0 8px;
  font-size: 1rem;
}
```

Add immediately after it:

```css
.card h2 {
  margin: 0 0 8px;
  font-size: 1rem;
}

.my-team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.my-team-row h2 {
  margin: 0;
}
```

- [ ] **Step 3: Verify scope**

Run: `git diff app.js styles.css`
Expected: `renderSetup`'s "My Team" card shows the new `<div class="my-team-row">` structure and the zero-teams branch's own `<h2>`; `styles.css` shows the two new rules added after `.card h2` (which itself is unchanged). No other function or selector differs.

- [ ] **Step 4: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure markup/CSS change, count must match the current baseline.

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css
git commit -m "Put My Team heading and dropdown on one line"
```

- [ ] **Step 6: Manual verification (deferred to the user)**

There is no automated test for this (pure markup/CSS, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. Setup's "My Team" card shows the heading and the team dropdown side by side on one line, no "Saved team" label text anywhere.
2. Spacing before the active-roster checklist below is visually reasonable (no awkward gap or missing gap).
3. The zero-teams state still shows "My Team" as a heading, followed by "No teams yet — create one from the Teams tab."
4. The dropdown's behavior (selecting a team resets the checklist) is unaffected.
