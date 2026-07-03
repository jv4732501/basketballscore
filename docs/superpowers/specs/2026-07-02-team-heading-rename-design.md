# Rename "My Team" Heading to "Team"; Remove HoopScore H1

## Problem

Two small text/markup changes to the Setup screen: shorten the "My Team" section heading to just "Team", and remove the `<h1>HoopScore</h1>` title entirely.

## Scope

- `app.js`: `renderSetup`'s two `<h2>My Team</h2>` occurrences (the has-teams branch, inside `.my-team-row`, and the zero-teams fallback branch) become `<h2>Team</h2>`. The `<h1>HoopScore</h1>` line is deleted.
- Out of scope (per explicit scope decision): the tip-off button's fallback label (`currentMyTeamName(d) || 'My Team'`) and the History screen's fallback team name (`g.myTeam?.name ?? 'My Team'`) are untouched — these are default/fallback team-name strings, not section headings, and keep their current text.

## Approach

Current:
```js
  el.innerHTML = `
    ${banner}
    <h1>HoopScore</h1>
    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>My Team</h2>
          <select id="my-team-select">
            ...
          </select>
        </div>
        <ul class="roster">${renderActiveRoster(d)}</ul>`
          : `<h2>My Team</h2><p class="muted">No teams yet — create one from the Teams tab.</p>`
      }
    </section>
```

Becomes:
```js
  el.innerHTML = `
    ${banner}
    <section class="card">
      ${
        state.teams.length
          ? `
        <div class="my-team-row">
          <h2>Team</h2>
          <select id="my-team-select">
            ...
          </select>
        </div>
        <ul class="roster">${renderActiveRoster(d)}</ul>`
          : `<h2>Team</h2><p class="muted">No teams yet — create one from the Teams tab.</p>`
      }
    </section>
```

## Testing

Pure text/markup change — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Setup screen no longer shows the "HoopScore" title at the top.
2. The team card's heading reads "Team" instead of "My Team", in both the has-teams and zero-teams states.
3. The tip-off button and History screen still show "My Team" as their fallback text (unchanged).
