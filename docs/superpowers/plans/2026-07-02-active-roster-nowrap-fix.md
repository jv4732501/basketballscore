# Active-Roster Checklist Nowrap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee the `#num name` text in Setup's active-roster checklist never wraps across two lines, regardless of available width.

**Architecture:** One markup change (wrap the text in an explicit `<span>`) and two CSS additions (`white-space: nowrap` on that span, `flex-shrink: 0` on the checkbox).

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), no build step.

## Global Constraints

- No other layout change — `.roster li label`'s existing `display:flex; align-items:center; gap:6px; cursor:pointer;` (from Cycle 24) is untouched.
- The opponent roster (`renderRoster`) is not modified.

---

### Task 1: Wrap checklist text in a `<span>`, add nowrap + flex-shrink CSS

**Files:**
- Modify: `app.js:740-751` (`renderActiveRoster`)
- Modify: `styles.css:159-168` (the Cycle 24 `.roster li label`/`.roster li input[type='checkbox']` rules)

**Interfaces:** N/A — this is the only task in the plan; pure markup/CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Wrap the text in a `<span>`**

In `app.js`, find:

```js
function renderActiveRoster(d) {
  const t = state.teams.find((x) => x.id === d.myTeamId);
  if (!t || !t.players.length) return `<p class="muted">No players on this team yet.</p>`;
  return t.players
    .map(
      (p) => `
    <li>
      <label><input type="checkbox" data-active="${p.id}" ${d.activePlayerIds.includes(p.id) ? 'checked' : ''}> #${p.num} ${esc(p.name || '')}</label>
    </li>`,
    )
    .join('');
}
```

Replace with:

```js
function renderActiveRoster(d) {
  const t = state.teams.find((x) => x.id === d.myTeamId);
  if (!t || !t.players.length) return `<p class="muted">No players on this team yet.</p>`;
  return t.players
    .map(
      (p) => `
    <li>
      <label><input type="checkbox" data-active="${p.id}" ${d.activePlayerIds.includes(p.id) ? 'checked' : ''}><span>#${p.num} ${esc(p.name || '')}</span></label>
    </li>`,
    )
    .join('');
}
```

- [ ] **Step 2: Add `flex-shrink: 0` to the checkbox and `white-space: nowrap` to the new span**

In `styles.css`, find:

```css
.roster li label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.roster li input[type='checkbox'] {
  margin: 0;
}
```

Replace with:

```css
.roster li label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.roster li input[type='checkbox'] {
  margin: 0;
  flex-shrink: 0;
}

.roster li label span {
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify scope**

Run: `git diff app.js styles.css`
Expected: `renderActiveRoster` shows the text now wrapped in `<span>...</span>`; `styles.css` shows `flex-shrink: 0;` added to the checkbox rule and a new `.roster li label span { white-space: nowrap; }` rule. No other function or selector differs.

- [ ] **Step 4: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — pure markup/CSS change, count must match the current baseline.

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css
git commit -m "Prevent active-roster checklist text from wrapping across lines"
```

- [ ] **Step 6: Manual verification (deferred to the user)**

There is no automated test for this (pure CSS/markup, no logic). Since this sandbox has no browser available, ask the user to verify in the actual app (after a hard refresh, to rule out any cached stylesheet):

1. Every row in Setup's active-roster checklist shows the checkbox and `#num name` fully on one line, never wrapping, even for longer names.
2. The opponent roster and other `.roster` lists elsewhere are unaffected.
