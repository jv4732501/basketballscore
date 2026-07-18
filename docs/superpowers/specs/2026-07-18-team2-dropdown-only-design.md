# Team 2 Becomes Dropdown-Only (Saved Team Required)

## Problem

The previous cycle let Team 2 (opponent) either link to a saved team (typed
exact-match + autocomplete) or stay freeform (typed name, hand-built
per-game roster). In practice this dual-mode UI is more complexity than the
app needs: Team 1 is already dropdown-only, and the freeform escape hatch
means Team 2's Setup card looks and behaves differently depending on what
you type, with matching logic, a datalist, and two different roster
widgets to maintain.

## Goal

Team 2 becomes a second instance of exactly what Team 1 already is: a
dropdown of saved teams + an active-player checkbox roster. A saved team is
now required for both slots. Roster editing for either team stays exclusive
to the Teams tab; Setup only picks who's playing today.

Home/Away stays completely unrelated to this change — it remains an
independent toggle (`config.myTeamSide`) with its own swap button on the
live game screen, precisely because which team is "Team 1" vs "Team 2" is
usually known well before which one is Home vs Away is (confirmed with the
user: this is often only known once sitting in the venue, at or after
tip-off — unrelated to how the teams were picked at Setup).

## What's removed

- The Team 2 name text box, its `<datalist>` autocomplete, and the
  exact-match linking logic (`findTeamByName`, the `oninput` handler's
  linked/freeform branching, the focus-preservation workaround it needed).
- The freeform manual roster: the add-player mini-form (`opp-add-num`,
  `opp-add-name`, `opp-add-btn`), the "×"-removable list, and the
  `[data-rm]` wiring block in `wireSetup()` that spliced it.
- `setupDraft.oppName` and `setupDraft.oppPlayers` — no longer needed once
  Team 2's roster always comes from a saved team.
- `startGame()`'s linked-vs-freeform branch and the "Enter Team 2's name."
  validation message (a saved team is picked from a dropdown, so there's
  nothing to type or leave blank).
- `addPlayer(numEl, nameEl)` (the freeform add-player handler) — no
  remaining callers.
- `renderRoster()`'s non-`'te'` branch (the "×"-removable freeform list) —
  its only caller was Team 2's card; the Teams-tab editor's call
  (`which === 'te'`) is the only one left, so the function simplifies to
  drop the now-unused `which` parameter and always render the editor-style
  list.
- The `.opp-row` / `.opp-row input` CSS rules (styles.css) — only used by
  the removed text box.

## What's added / changed

Team 2's Setup card becomes structurally identical to Team 1's, reusing
`renderActiveRosterFor` (already generalized in the prior cycle):

```html
<section class="card">
  ${
    state.teams.length
      ? `
    <div class="my-team-row">
      <h2>Team 2</h2>
      <select id="opp-team-select">
        ${state.teams.map((t) => `<option value="${t.id}" ${t.id === d.oppTeamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>
    </div>
    <ul class="roster">${renderActiveRosterFor(d.oppTeamId, d.activeOppPlayerIds, 'opp')}</ul>`
      : `<h2>Team 2</h2><p class="muted">Create a team on team tab.</p>`
  }
</section>
```

Wiring mirrors `my-team-select`'s `onchange` exactly:

```js
const oppSel = $('opp-team-select');
if (oppSel)
  oppSel.onchange = () => {
    d.oppTeamId = oppSel.value;
    const t = state.teams.find((x) => x.id === oppSel.value);
    d.activeOppPlayerIds = t ? t.players.map((p) => p.id) : [];
    renderSetup();
  };
```

`defaultDraft()` sets `oppTeamId` to the second saved team when one exists
(so the two dropdowns don't both start on the same team), falling back to
the first (or `null` if no teams exist yet):

```js
oppTeamId: state.teams[1]?.id ?? state.teams[0]?.id ?? null,
activeOppPlayerIds: (state.teams[1] ?? state.teams[0])
  ? (state.teams[1] ?? state.teams[0]).players.map((p) => p.id)
  : [],
```

`renderSetup()`'s self-heal for a deleted `oppTeamId` mirrors `myTeamId`'s
existing self-heal exactly (always required now — no more "fall back to
freeform" special case):

```js
if (!state.teams.some((t) => t.id === d.oppTeamId)) {
  const fallback = state.teams[1] ?? state.teams[0];
  d.oppTeamId = fallback?.id ?? null;
  d.activeOppPlayerIds = fallback ? fallback.players.map((p) => p.id) : [];
}
```

`startGame()` validates Team 2 the same way it validates Team 1 (found +
has at least one active player), replacing the linked/freeform branch:

```js
const oppTeam = state.teams.find((t) => t.id === d.oppTeamId);
if (!oppTeam) {
  err.textContent = 'Select a second team from the Teams tab first.';
  return;
}
const activeOppPlayers = oppTeam.players.filter((p) => d.activeOppPlayerIds.includes(p.id));
if (!activeOppPlayers.length) {
  err.textContent = 'Select at least one active player for Team 2.';
  return;
}
```

with `oppTeam: { id: oppTeam.id, name: oppTeam.name, players: activeOppPlayers }`
passed into `newGame()` in place of the old `d.oppName.trim()` /
`oppPlayers` construction.

**`newGame()` itself is not touched.** Its existing conditional-spread
handling of `oppTeam.id` (`...(oppTeam.id !== undefined && { id: oppTeam.id })`)
stays exactly as-is — it's still correct and still covered by the
"serialize/deserialize round-trips a game" test, which doesn't require an
id. `startGame()` will now always pass a defined id in practice, but
`newGame()` as a general-purpose pure function has no reason to forbid the
id-less case, and changing it isn't part of this task.

## Backward compatibility

None needed — this app has never been released, so there's no installed
base with saved games/teams whose shape has to keep working across this
change. Nothing in this design adds migration code for that reason.

(As a natural consequence of not touching `newGame()`, `migrateGame()`, or
`deserialize()`: any already-existing local game history with a freeform,
id-less `oppTeam` would in fact continue to display fine, since History and
Summary screens read `game.oppTeam.name`/`players` directly rather than
reconstructing via `newGame()`. This is incidental, not a requirement being
designed for.)

## Testing

This is entirely Setup-screen shell code — consistent with this
codebase's existing convention of leaving DOM/render/wiring code to manual
verification (no unit tests for `wireSetup`, `renderSetup`, or
`startGame`'s DOM-facing parts today).

Manual verification (user):

1. On Setup, confirm Team 2 shows a dropdown + checkbox roster, matching
   Team 1's look. No text box, no autocomplete, no add-player form.
2. With 2+ saved teams, confirm Team 2 defaults to a different team than
   Team 1 initially selects.
3. Change Team 2's dropdown selection — confirm its roster checkboxes
   update to the newly selected team's players (all checked by default).
4. Uncheck a Team 2 player, Start the game — confirm only active players
   appear for Team 2 in-game.
5. With only 1 saved team total, confirm both Team 1 and Team 2 offer that
   same team (no crash, no empty dropdown).
6. With 0 saved teams, confirm both cards show "Create a team on team tab."
   and Start is blocked with a clear error.
7. Start a game, add a player mid-game to Team 2 via the Activity dialog —
   confirm it still writes back to that saved team (Teams tab reflects the
   addition), exactly as it did last cycle.
8. Confirm the Home/Away toggle and the swap-home-away button on the live
   game screen are both unaffected by this change.

## Out of scope (YAGNI)

- No prevention of picking the same saved team for both Team 1 and Team 2
  — allowed today, stays allowed (an accepted, coherent edge case from the
  prior cycle's review).
- No migration/cleanup of old freeform game history entries.
- No change to Home/Away, the swap button, or `config.myTeamSide`.
