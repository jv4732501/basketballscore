# Active-Roster Checklist: Prevent Text Wrapping (Cycle 24 follow-up)

## Problem

After Cycle 24's fix (`.roster li label { display:flex; align-items:center; gap:6px; }`), the user still reports the player's `#num name` text splitting across two lines. The `#num name` text sits as a bare text node directly inside the flex `<label>`, which makes it an *anonymous* flex item — anonymous flex items can still wrap their own inline content internally if the item's box narrows below the text's natural width (e.g. a long player name on a narrow viewport, or the checkbox taking more space than expected). Cycle 24's fix corrected the checkbox/text row layout but didn't explicitly prevent the text itself from wrapping.

## Scope

- `app.js`: `renderActiveRoster` wraps `#num name` in an explicit `<span>` instead of a bare text node.
- `styles.css`: the new span gets `white-space: nowrap`; the checkbox gets `flex-shrink: 0` so it's never compressed to make room for the text.
- Out of scope: no other layout change; the opponent roster (`renderRoster`) is untouched.

## Approach

Current (`renderActiveRoster`):
```js
(p) => `
    <li>
      <label><input type="checkbox" data-active="${p.id}" ${d.activePlayerIds.includes(p.id) ? 'checked' : ''}> #${p.num} ${esc(p.name || '')}</label>
    </li>`,
```

Becomes:
```js
(p) => `
    <li>
      <label><input type="checkbox" data-active="${p.id}" ${d.activePlayerIds.includes(p.id) ? 'checked' : ''}><span>#${p.num} ${esc(p.name || '')}</span></label>
    </li>`,
```

Current CSS (from Cycle 24):
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

Becomes:
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

`white-space: nowrap` on the new span guarantees `#num name` renders as a single line no matter how narrow the container gets (it will overflow rather than wrap, which is preferable to a broken two-line row for what's normally a short string). `flex-shrink: 0` on the checkbox prevents the browser from shrinking it to reclaim space for the text, which could otherwise distort its shape.

## Testing

Pure CSS/markup — no logic, no automated test coverage applies (matches the precedent set by prior visual-only fixes). Manual verification (deferred to the user, since this sandbox has no browser):

1. Every row in Setup's active-roster checklist shows the checkbox and `#num name` fully on one line, never wrapping, even for longer names.
2. The opponent roster and other `.roster` lists elsewhere are unaffected.
