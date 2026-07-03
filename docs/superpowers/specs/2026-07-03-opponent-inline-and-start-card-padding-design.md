# Opponent Field Inline Layout + Reduced Start Card Padding

## Problem

Two small Setup screen tweaks:

1. The "Opponent" label and its text input render on separate lines, because `.card label { display: block; }` combined with `.card input { width: 100%; }` forces the input onto its own full-width line below the label text. The user wants the input on the same line as the label.
2. The Start button's card uses the shared `.card { padding: 12px 14px; }`, the same as every other card, and it looks like too much empty space around just a button and an error line.

## Scope

- `app.js`: give the Opponent `<label>` a new class (e.g. `opp-row`); give the Start button's `<section class="card">` a second class (e.g. `start-card`).
- `styles.css`: new `.opp-row` rule (flex layout, overriding the input's `width: 100%` to `flex: 1` for just this field); new `.start-card` rule (padding: 6px, overriding `.card`'s padding for just this card).
- Out of scope: no other `.card label`/`.card input` combination changes (e.g. "Team name" in the Team Editor keeps its current stacked layout); no other card's padding changes.

## Approach

### Opponent field inline layout

Current:
```js
      <label>Opponent <input id="opp-name" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
```

Becomes:
```js
      <label class="opp-row">Opponent <input id="opp-name" value="${esc(d.oppName)}" placeholder="e.g. Celtics"></label>
```

New CSS (added after `.card input, .card select`, so it wins the cascade over that shared rule):
```css
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

`display: flex` on the label keeps "Opponent" and the input on one row; `flex: 1` lets the input fill the remaining space instead of the `100%` width it inherits from `.card input`, which is what was forcing it onto its own line.

### Start card padding

Current:
```js
    <section class="card">
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
```

Becomes:
```js
    <section class="card start-card">
      <button id="btn-start-home" class="startbtn">Start</button>
      <p id="setup-error" class="error"></p>
    </section>
```

New CSS (added after `.card`):
```css
.start-card {
  padding: 6px;
}
```

## Testing

Pure markup/CSS — no logic, no automated test coverage applies (matches the precedent set by prior visual-only changes). Manual verification (deferred to the user, since this sandbox has no browser):

1. "Opponent" label and its input are on one line.
2. Other label/input pairs elsewhere (Team name in the Team Editor, Half length, etc.) are unchanged.
3. The Start button's card has visibly less padding than the other cards on the Setup screen.
