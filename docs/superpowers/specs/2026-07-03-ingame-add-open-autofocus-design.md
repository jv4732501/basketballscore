# Auto-Focus Number Field When Opening the In-Game Add Form

## Problem

Cycle 32 made the number field regain focus *after adding* a player in the in-game "+ Add" form. But the first time you tap "+ Add" to open the form, focus doesn't move into the "#" field at all — you still have to tap into it manually before typing the first player's number.

## Scope

- `app.js`: the `[data-addopen]` click handler (in `wireGame`, the "+ Add" button's wiring) focuses the newly shown `[data-addnum="${addOpen}"]` input right after `render()`.
- Out of scope: no change to `[data-addclose]` ("Close" button) or `[data-addgo]` (the "Add" button, already fixed in Cycle 32) wiring.

## Approach

Same technique as the rest of this feature: `render()` synchronously rebuilds the DOM before returning, so the newly created number input already exists by the time the next line runs.

Current:
```js
  el_each(
    '[data-addopen]',
    (b) =>
      (b.onclick = () => {
        addOpen = b.dataset.addopen;
        render();
      }),
  );
```

Becomes:
```js
  el_each(
    '[data-addopen]',
    (b) =>
      (b.onclick = () => {
        addOpen = b.dataset.addopen;
        render();
        document.querySelector(`[data-addnum="${addOpen}"]`).focus();
      }),
  );
```

## Testing

Pure UI-interaction behavior — no automated test coverage applies (matches the precedent set by Cycle 30/32; this handler is DOM-driven, not a pure function). Manual verification (deferred to the user, since this sandbox has no browser):

1. During a live game, tapping "+ Add" for either team opens the add-player form with the cursor already in the "#" field, ready to type immediately.
2. This works independently for both "my" team and "opp" team's add-forms.
3. Adding a player (Cycle 32's fix) still returns focus to "#" afterward, and "Close" still works as before.
