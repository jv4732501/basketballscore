# Formatting Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add zero-install, automatic formatting via VS Code's bundled formatters, plus an optional manual Prettier check/fix, then apply that Prettier formatting once to the existing codebase.

**Architecture:** Two sequential tasks. Task 1 adds the configuration files and README docs (no reformatting yet). Task 2 depends on Task 1's `.prettierrc` and runs the actual one-time reformat, committed separately so the config addition and the reformat are each independently reviewable/revertable.

**Tech Stack:** VS Code's bundled language formatters (`vscode.typescript-language-features`, `vscode.css-language-features`, `vscode.html-language-features` — built in, no extension install). Prettier via `npx` (temporary download, not a permanent install, network required) for the optional manual path and the one-time reformat. Node's built-in test runner (`node --test`) to verify no behavior change.

## Global Constraints

- No new permanent dependencies, no `npm install`, no `package.json` — matches the project's existing "no build, no dependencies" stance and the precedent set by the zero-install linting setup.
- Automatic (format-on-save) behavior must work with zero installs — it must not depend on any VS Code extension, including Prettier's.
- The documented Prettier command must list `app.js styles.css logic.test.js` explicitly — never `.` — so it never touches `docs/`, `jsconfig.json`, `types.d.ts`, or `index.html`.
- `.prettierrc` values: `{ "singleQuote": true, "semi": true, "tabWidth": 2, "printWidth": 100 }` — exact values, copied verbatim from the spec.
- The one-time reformat must not change behavior: `node --test` must report the same pass count (60/60) before and after, and both `app.js` and `logic.test.js` must still pass `node --check` after.

---

### Task 1: Add VS Code settings, Prettier config, and README docs

**Files:**
- Create: `.vscode/settings.json`
- Create: `.prettierrc`
- Modify: `README.md` (insert a `## Formatting` section after `## Linting`, before `## Deploy`)

**Interfaces:**
- Produces: `.prettierrc` at the repo root, which Task 2's `npx prettier --write` invocation reads implicitly (Prettier auto-discovers config files in the current directory — no flag needed).

- [ ] **Step 1: Create `.vscode/settings.json`**

Create the directory and file with exactly this content:

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

- [ ] **Step 2: Create `.prettierrc`**

Create `.prettierrc` at the repo root with exactly this content:

```json
{ "singleQuote": true, "semi": true, "tabWidth": 2, "printWidth": 100 }
```

- [ ] **Step 3: Add the `## Formatting` section to `README.md`**

`README.md` currently has this section (among others):

```markdown
## Linting
Type-checking runs automatically in VS Code via `jsconfig.json` — open the project and check the Problems panel, no install needed.
Optional one-off terminal check: `npx tsc --noEmit -p jsconfig.json` (downloads TypeScript temporarily; requires network, not a permanent install).

Known false positives (not real bugs, left as-is to avoid scope creep — see `.superpowers/sdd/progress.md` Cycle 10 for details):
- ~10 "Property 'value'/'click' does not exist" errors where `app.js`'s `$(id)` DOM helper returns a generic `HTMLElement`/`Element` instead of the specific input/button subtype.
- 2 "Cannot find name 'node:test'"/`'node:assert'` errors in `logic.test.js` — a hardcoded TypeScript diagnostic for `require()`-ing Node builtins without `@types/node`, which ambient module declarations can't suppress.

## Deploy
```

Insert a new `## Formatting` section directly after the "Known false positives" list and before `## Deploy`, so that portion of the file reads:

```markdown
## Linting
Type-checking runs automatically in VS Code via `jsconfig.json` — open the project and check the Problems panel, no install needed.
Optional one-off terminal check: `npx tsc --noEmit -p jsconfig.json` (downloads TypeScript temporarily; requires network, not a permanent install).

Known false positives (not real bugs, left as-is to avoid scope creep — see `.superpowers/sdd/progress.md` Cycle 10 for details):
- ~10 "Property 'value'/'click' does not exist" errors where `app.js`'s `$(id)` DOM helper returns a generic `HTMLElement`/`Element` instead of the specific input/button subtype.
- 2 "Cannot find name 'node:test'"/`'node:assert'` errors in `logic.test.js` — a hardcoded TypeScript diagnostic for `require()`-ing Node builtins without `@types/node`, which ambient module declarations can't suppress.

## Formatting
Format-on-save is automatic in VS Code via `.vscode/settings.json` — built-in formatters, no extension needed.
Optional one-off terminal check/fix: `npx prettier --check app.js styles.css logic.test.js` / `npx prettier --write app.js styles.css logic.test.js` (downloads temporarily; requires network, not a permanent install).

## Deploy
```

Do not modify the `## Linting` section's existing text — only insert the new `## Formatting` section after it.

- [ ] **Step 4: Commit**

```bash
git add .vscode/settings.json .prettierrc README.md
git commit -m "Add formatting config: VS Code settings + optional Prettier"
```

- [ ] **Step 5: Verify nothing else changed**

Run: `git status`
Expected: clean working tree (everything from Step 4 is committed; no other files modified).

---

### Task 2: One-time reformat of app.js, styles.css, logic.test.js

**Files:**
- Modify: `app.js` (reformatted in place, no manual edits — Prettier output only)
- Modify: `styles.css` (reformatted in place, no manual edits — Prettier output only)
- Modify: `logic.test.js` (reformatted in place, no manual edits — Prettier output only)

**Interfaces:**
- Consumes: `.prettierrc` from Task 1 (must already be committed — verify with `git log --oneline -1 .prettierrc` before starting; if it's missing, stop and report NEEDS_CONTEXT rather than proceeding without it).

- [ ] **Step 1: Record baseline test count and line counts**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` (record this exact output for comparison after reformatting).

Run: `wc -l app.js styles.css logic.test.js`
Expected (approximate baseline, exact numbers may drift slightly if other changes landed first): `app.js` ~1260 lines, `styles.css` ~125 lines, `logic.test.js` ~553 lines.

- [ ] **Step 2: Run Prettier**

Run: `npx --yes prettier --write app.js styles.css logic.test.js`
Expected output: three lines, one per file, each ending in a timing suffix like `app.js 187ms` / `styles.css 79ms` / `logic.test.js 52ms` (exact ms values will vary run to run — that's fine).

- [ ] **Step 3: Verify the JS files still parse**

Run: `node --check app.js && node --check logic.test.js && echo "SYNTAX OK"`
Expected: `SYNTAX OK` with no errors printed.

- [ ] **Step 4: Verify no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 60`, `pass 60`, `fail 0` — identical pass count to Step 1's baseline. If the count differs, STOP — do not commit — and report BLOCKED with the diff between before/after test output, since that would mean the reformat altered behavior, not just style.

- [ ] **Step 5: Sanity-check line count growth is in the expected range**

Run: `wc -l app.js styles.css logic.test.js`
Expected: `app.js` roughly 1600-1750 lines, `styles.css` roughly 600-700 lines (CSS rules expand from one dense line per rule to one declaration per line — this is expected and intentional per the spec, not a bug), `logic.test.js` roughly 580-620 lines. If any file's line count is wildly outside these ranges (e.g. more than double the upper bound, or shorter than the original), STOP and report BLOCKED — something unexpected happened.

- [ ] **Step 6: Commit**

```bash
git add app.js styles.css logic.test.js
git commit -m "Apply Prettier formatting to app.js, styles.css, logic.test.js"
```

- [ ] **Step 7: Manual verification (deferred to the user)**

There is no further automated check beyond Steps 3-5 above (this is a pure formatting change with test-suite parity already confirmed). Since this sandbox has no VS Code available, ask the user to:

1. Open `app.js` or `styles.css` in VS Code, make a trivial whitespace edit, save, and confirm formatting is applied automatically (e.g. trailing whitespace trimmed) — this exercises the `.vscode/settings.json` from Task 1.
2. Confirm the Problems panel (from the existing `jsconfig.json` linting setup) shows the same errors as before the reformat (the ~12 documented known-false-positives from the README's Linting section), none newly introduced by the reformat.
