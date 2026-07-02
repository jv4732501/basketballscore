# Formatting Rules (to go with checkJs linting)

## Problem

The project has no formatting configuration — no `.editorconfig`, no `.vscode/settings.json`, no Prettier. The existing code is fairly consistent by convention (2-space indent, single quotes, semicolons), but nothing enforces it, and `styles.css` in particular packs every rule onto one dense line rather than one-declaration-per-line. This is a companion to the existing zero-install linting (`jsconfig.json` + `checkJs`, added 2026-07-01) — same "no npm install, no build step" constraint applies.

## Scope

- Add `.vscode/settings.json`: automatic, zero-install, format-on-save using VS Code's bundled language formatters (no extension required).
- Add `.prettierrc`: config for an optional, manual, one-off `npx prettier` check/fix — mirrors the already-documented optional `npx tsc --noEmit` linting check. Scoped to JS **and** CSS (accepting that CSS's dense one-line rules will expand to one-declaration-per-line if `--write` is ever run).
- Add a `## Formatting` section to `README.md` (after `## Linting`, before `## Deploy`) documenting both.
- Run `npx prettier --write` once now on `app.js`, `styles.css`, and `logic.test.js`, committed separately from the config commit, so the repo starts from a consistently formatted baseline.
- Out of scope: `docs/**/*.md`, `jsconfig.json`, `types.d.ts`, `index.html` are not reformatted or covered by the documented Prettier command (which lists files explicitly, not `.`).

## Approach

### `.vscode/settings.json` (new)

```json
{
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.formatOnSave": true,
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "[javascript]": { "editor.defaultFormatter": "vscode.typescript-language-features" },
  "[css]": { "editor.defaultFormatter": "vscode.css-language-features" },
  "[html]": { "editor.defaultFormatter": "vscode.html-language-features" }
}
```

`vscode.typescript-language-features`, `vscode.css-language-features`, and `vscode.html-language-features` are extensions bundled with VS Code itself (not marketplace installs) — pinning `editor.defaultFormatter` to them means format-on-save keeps using zero-install tooling even if a different formatter extension (e.g. Prettier's) is later installed for another project and becomes VS Code's global default.

### `.prettierrc` (new)

```json
{ "singleQuote": true, "semi": true, "tabWidth": 2, "printWidth": 100 }
```

Matches the codebase's existing conventions (single quotes, semicolons, 2-space indent). `printWidth: 100` was chosen over Prettier's 80-character default after a preview run showed 100 keeps object-literal-heavy lines (common throughout `app.js`) closer to their original density.

This config is **not** wired into VS Code automatically (that would require installing the Prettier extension, which contradicts the zero-install requirement for the automatic path). It only takes effect when someone explicitly runs the documented `npx prettier` command.

### `README.md` (modified)

Insert a `## Formatting` section directly after `## Linting` and before `## Deploy`:

```markdown
## Formatting
Format-on-save is automatic in VS Code via `.vscode/settings.json` — built-in formatters, no extension needed.
Optional one-off terminal check/fix: `npx prettier --check app.js styles.css logic.test.js` / `npx prettier --write app.js styles.css logic.test.js` (downloads temporarily; requires network, not a permanent install).
```

The command names the three files explicitly rather than `.` so a future run never touches `docs/`, `jsconfig.json`, `types.d.ts`, or `index.html`.

### One-time reformat

Run `npx prettier --write app.js styles.css logic.test.js` once, as part of this change, and commit the result in its own commit (separate from the config-file commit, so the config addition and the reformat are each independently reviewable/revertable).

**Verified impact** (measured via a preview run in a scratch copy, not yet applied to the real repo):
- `app.js`: 1260 → 1682 lines (mechanical reflow of long one-line function bodies/object literals; no line-wrapping inside template-literal placeholders, so the rendered HTML strings are visually unchanged).
- `styles.css`: 125 → 645 lines (every rule's declarations expand from one dense line to one-declaration-per-line — a real, large visual change to this file's style, accepted per explicit decision).
- `logic.test.js`: 553 → 601 lines (mild reflow).
- Confirmed pure formatting: `node --check` passes on both JS files post-format, and the full test suite (`node --test`) still reports 60/60 passing — no behavioral change.

## Testing

Formatting is verified by re-running the existing test suite after the reformat (`node --test`, expect 60/60 — same count as before, since this is a non-behavioral change) plus `node --check app.js logic.test.js` to confirm both files still parse. No new automated tests are needed (this is tooling/style, not logic).

Manual verification (deferred to the user, since this sandbox has no VS Code available):
1. Open `app.js` or `styles.css` in VS Code, make a trivial whitespace edit, save, and confirm formatting is applied automatically (e.g. trailing whitespace trimmed).
2. Confirm the Problems panel (from the existing linting setup) is unaffected by the reformat — same errors as before the reformat, none introduced by it.
