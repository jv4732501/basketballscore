# Fix Stale Team Selection on Setup After Creating a Team

## Problem

Creating a team (via the Teams tab) while `state.teams` was previously empty, then switching back to Setup, shows the new team in the dropdown but an empty player checklist below it.

## Root Cause

`setupDraft` is a module-level variable created once (`if (!setupDraft) setupDraft = defaultDraft();`) and never invalidated when `state.teams` changes elsewhere. `defaultDraft()` sets `myTeamId: state.teams[0]?.id ?? null` — if Setup was first rendered with zero teams, `myTeamId` becomes `null` and stays `null` forever, since nothing in the "create a team" flow (`Team Editor`'s Save, which does `state.teams.push(...)`) touches `setupDraft`.

When Setup re-renders with a team now in `state.teams` but `d.myTeamId` still `null`, the `<option>` list has no entry with `selected` (since `t.id === null` never matches), so the browser's default behavior displays the first `<option>` anyway — visually showing a team, while `d.myTeamId` is still `null` underneath. `renderActiveRoster(d)` and the "My Team" card both look up `state.teams.find(t => t.id === d.myTeamId)`, which fails, so the roster renders as empty. The desync is invisible until the user manually picks a *different* value from the dropdown (which fires `onchange` and correctly syncs `d.myTeamId`/`d.activePlayerIds`) — picking the same, already-displayed value fires no `change` event at all, so a single-team user can get stuck.

The same desync also happens, independently of team count, if the team `d.myTeamId` points to gets deleted from the Teams tab — the id no longer matches anything in `state.teams`, with the same visual-vs-actual mismatch.

## Scope

- `app.js`: `renderSetup()` — right after ensuring `setupDraft` exists, validate `d.myTeamId` against the current `state.teams` and self-heal (reset to the first team + its full roster) if it no longer matches any team.
- Out of scope: no change to `defaultDraft()` itself, the dropdown's `onchange` handler, or any other Setup behavior. A *valid* `d.myTeamId` (matching any existing team, not just the first) is left untouched — this only corrects the broken case.

## Approach

Current:
```js
function renderSetup() {
  if (!setupDraft) setupDraft = defaultDraft();
  const d = setupDraft;
```

Becomes:
```js
function renderSetup() {
  if (!setupDraft) setupDraft = defaultDraft();
  const d = setupDraft;
  if (!state.teams.some((t) => t.id === d.myTeamId)) {
    d.myTeamId = state.teams[0]?.id ?? null;
    d.activePlayerIds = state.teams[0] ? state.teams[0].players.map((p) => p.id) : [];
  }
```

This mirrors `defaultDraft()`'s own fallback (first team, full roster pre-checked) and the dropdown's `onchange` handler's assignment shape, so the same "select a team → get its full roster" behavior applies whether it happens via user action or this self-heal.

## Testing

`renderSetup`/`setupDraft`/`defaultDraft` are DOM-rendering "shell" functions, not part of `app.js`'s exported pure-logic surface (`module.exports`) — no automated test coverage applies, matching the precedent for all prior UI-behavior fixes this session. Manual verification (deferred to the user, since this sandbox has no browser):

1. With zero teams, go to Setup (dropdown/roster area shows "No teams yet"). Go to Teams, create a team with a few players, save. Switch back to Setup ("New game" tab) — the new team's full roster should now show, all checked.
2. With one existing team already correctly selected on Setup, create a *second* team via the Teams tab, then switch back to Setup — the first team should remain selected with its roster intact (not reset to the new team).
3. Delete the team currently selected on Setup (via the Teams tab), then switch back to Setup — it should fall back to showing the next available team's roster (or "No teams yet" if none remain), not an empty roster under a phantom selection.
