# Team Editor Roster Consistency + Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Team Editor's roster rows to match the app's existing `.listrow`/`.listmain` + labeled-button pattern (used by the Teams tab's team list and History's game list), replace the unreliable double-click edit trigger with a plain "Edit" button, add a delete confirmation, and fix a focus-ring clipping bug on the edit dialog's inputs.

**Architecture:** One task touching `app.js` (`renderRoster`, `renderTeamEditor`'s wiring) and `styles.css` (remove one now-unused rule, add padding to another). No new files, no pure-function logic changes.

**Tech Stack:** Vanilla JS (`app.js`), plain CSS (`styles.css`), no build step.

## Global Constraints

- The `which === 'my'`/`'opp'` branch of `renderRoster` (used only by the Setup screen) must render byte-identical output to what it does today — no styling change, no Edit button, no confirmation there.
- `openRosterEditDialog` itself is not modified — it already operates on `teamEdit.players[i]` regardless of how the trigger UI looks.
- No new CSS classes for the buttons — `.list`, `.listrow`, `.listmain`, `.listrow button`, and `.listrow button.danger` already exist and must be reused verbatim, not redefined.
- The `[data-editpl]`/`dblclick` wiring is removed entirely, not fixed — double-click is dropped as a trigger now that a labeled "Edit" button exists.

---

### Task 1: Roster redesign, drop double-click, add delete confirmation, fix focus-ring clipping

**Files:**
- Modify: `app.js:749-765` (`renderRoster`), `app.js:953-966` (`renderTeamEditor`'s `[data-rm]`/`[data-editpl]` wiring)
- Modify: `styles.css:725-727` (remove `.editpl`), `styles.css:729-732` (`.dlgbody`)

**Interfaces:** N/A — this is the only task in the plan; pure markup/CSS, nothing here is consumed by other tasks.

- [ ] **Step 1: Redesign `renderRoster` for the `'te'` case**

In `app.js`, find:

```js
function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">No players yet</p>`;
  return (
    `<ul class="roster">` +
    players
      .map(
        (p, i) =>
          `<li>${
            which === 'te'
              ? `<span class="editpl" data-editpl="${which}:${i}">#${p.num} ${esc(p.name || '')}</span>`
              : `#${p.num} ${esc(p.name || '')}`
          }<button data-rm="${which}:${i}" class="rm">×</button></li>`,
      )
      .join('') +
    `</ul>`
  );
}
```

Replace with:

```js
function renderRoster(players, which) {
  if (!players.length) return `<p class="muted">No players yet</p>`;
  if (which === 'te') {
    return (
      `<ul class="list">` +
      players
        .map(
          (p, i) => `
        <li class="listrow">
          <span class="listmain">#${p.num} ${esc(p.name || '')}</span>
          <button data-editbtn="${which}:${i}">Edit</button>
          <button data-rm="${which}:${i}" class="danger">Delete</button>
        </li>`,
        )
        .join('') +
      `</ul>`
    );
  }
  return (
    `<ul class="roster">` +
    players
      .map(
        (p, i) =>
          `<li>#${p.num} ${esc(p.name || '')}<button data-rm="${which}:${i}" class="rm">×</button></li>`,
      )
      .join('') +
    `</ul>`
  );
}
```

- [ ] **Step 2: Update `renderTeamEditor`'s wiring — add confirmation, replace dblclick with Edit-button wiring**

In `app.js`, inside `renderTeamEditor`, find:

```js
  el_each(
    '[data-rm]',
    (b) =>
      (b.onclick = () => {
        const [, i] = b.dataset.rm.split(':'); // "te:i"
        d.players.splice(parseInt(i, 10), 1);
        renderTeams();
      }),
  );
  el_each('[data-editpl]', (b) =>
    b.addEventListener('dblclick', () => {
      const [, i] = b.dataset.editpl.split(':'); // "te:i"
      openRosterEditDialog(parseInt(i, 10));
    }),
  );
```

Replace with:

```js
  el_each(
    '[data-rm]',
    (b) =>
      (b.onclick = () => {
        const [, i] = b.dataset.rm.split(':'); // "te:i"
        const p = d.players[parseInt(i, 10)];
        if (!confirm(`Remove #${p.num}${p.name ? ' ' + p.name : ''} from the roster?`)) return;
        d.players.splice(parseInt(i, 10), 1);
        renderTeams();
      }),
  );
  el_each('[data-editbtn]', (b) =>
    (b.onclick = () => {
      const [, i] = b.dataset.editbtn.split(':'); // "te:i"
      openRosterEditDialog(parseInt(i, 10));
    }),
  );
```

- [ ] **Step 3: Remove the now-unused `.editpl` CSS rule**

In `styles.css`, find:

```css
.editpl {
  cursor: pointer;
}
```

Delete this rule entirely (including the blank line either directly above or below it — leave exactly one blank line between the surrounding rules, matching the file's existing spacing convention).

- [ ] **Step 4: Fix the focus-ring clipping on `.dlgbody`**

In `styles.css`, find:

```css
.dlgbody {
  overflow-y: auto;
  font-size: 0.85rem;
}
```

Replace with:

```css
.dlgbody {
  overflow-y: auto;
  font-size: 0.85rem;
  padding: 3px;
}
```

- [ ] **Step 5: Verify scope**

Run: `git diff app.js styles.css`
Expected: `renderRoster` shows the new `'te'`-branch code; `renderTeamEditor`'s wiring shows the confirmation added to `[data-rm]` and `[data-editpl]` replaced by `[data-editbtn]`; `styles.css` shows `.editpl` removed and `.dlgbody` gaining one `padding` line. No other selector or function differs. Confirm `wireSetup()`'s separate `[data-rm]` handler (a different code block, for the `'my'`/`'opp'` Setup-screen roster) does not appear in the diff at all.

- [ ] **Step 6: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — this task is pure markup/CSS/wiring, no pure-function logic touched, so the count must match the current baseline exactly.

- [ ] **Step 7: Commit**

```bash
git add app.js styles.css
git commit -m "Match Team Editor roster rows to listrow pattern; drop unreliable dblclick edit; add delete confirmation; fix focus-ring clipping"
```

- [ ] **Step 8: Manual verification (deferred to the user)**

There is no automated test for this (pure UI-interaction/markup/CSS, no logic — matches the precedent set throughout this app's interaction code). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. The Team Editor's roster rows now look like the Teams tab's team list and the History tab's game list — a card-style row with `#num name` on the left, "Edit" and "Delete" (red) buttons on the right.
2. Tapping "Edit" opens the Edit Player dialog, pre-filled, exactly as before.
3. Double-clicking the player text no longer does anything (expected — removed intentionally).
4. Tapping "Delete" shows a confirmation ("Remove #N Name from the roster?"); confirming removes the player, Cancel leaves the roster unchanged.
5. Clicking into either input field in the Edit Player dialog shows a complete, unclipped focus ring.
6. The Setup screen's roster (before starting a game) is unaffected — same compact `#num name ×` style, no Edit button, no confirmation.
7. The Team Editor's Save/Cancel flow and the Teams tab's own "Delete team" confirmation are unaffected.
