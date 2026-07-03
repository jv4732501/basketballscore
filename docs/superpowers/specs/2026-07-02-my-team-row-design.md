# Setup Screen: "My Team" Heading + Dropdown on One Line

## Problem

The Setup screen's "My Team" card shows the `<h2>My Team</h2>` heading, then a separate `<label>Saved team <select>...</select></label>` on its own line below. The user wants the "Saved team" label text removed, and the dropdown moved onto the same line as the "My Team" heading.

## Scope

- `app.js`: `renderSetup`'s "My Team" card markup — wrap `<h2>My Team</h2>` and the bare `<select id="my-team-select">` (no more `<label>Saved team...</label>` wrapper) in a new `.my-team-row` flex container. The zero-teams fallback branch keeps its own `<h2>My Team</h2>` above the "No teams yet" message.
- `styles.css`: new `.my-team-row` rule (flex row, heading left / select right, matching how this app already positions label+controls in `.listrow`-style rows elsewhere) and a `.my-team-row h2` override to zero out the heading's own bottom margin (now redundant since the row itself carries that spacing).
- Out of scope: no change to the dropdown's options/behavior, the active-roster checklist below it, or any other card on the Setup screen.

## Approach

Current (`renderSetup`):
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

Becomes:
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

CSS (added after the existing `.card h2` rule):
```css
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

`.my-team-row`'s `margin-bottom: 8px` replaces the spacing `.card h2`'s own `margin: 0 0 8px` used to provide before the roster list — since the heading is now a flex item positioned next to the select rather than stacked above it, its own bottom margin no longer creates that vertical gap, so the row itself carries it instead. `.my-team-row h2` (more specific than the general `.card h2` rule) zeroes out the heading's now-redundant margin to avoid any residual spacing artifact inside the row.

## Testing

Pure markup/CSS — no logic change, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Setup's "My Team" card shows the heading and the team dropdown side by side on one line, no "Saved team" label text anywhere.
2. Spacing before the active-roster checklist below is visually equivalent to before (no awkward gap or missing gap).
3. The zero-teams state still shows "My Team" as a heading, followed by "No teams yet — create one from the Teams tab."
4. The dropdown's behavior (selecting a team resets the checklist) is unaffected.
