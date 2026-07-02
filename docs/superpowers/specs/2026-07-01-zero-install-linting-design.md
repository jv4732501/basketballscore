# Zero-Install Linting via VS Code + TypeScript checkJs

## Problem

The project has no linter. Adding a standard one (ESLint) would require npm, `package.json`, and `node_modules` — which contradicts the project's existing "no build, no dependencies" stance (see `README.md`: "no `npm install`"). We want linting-equivalent feedback (catch typos, references to undefined variables, dead code, unused locals) without adding any install step.

## Approach

VS Code ships its own internal copy of the TypeScript language service, which can type-check plain `.js` files (`checkJs`) with zero project-level installs — it works the moment a `jsconfig.json` is present, using only the editor's bundled tooling. This gives most of the practical value of a linter (catching real structural bugs) without touching the project's dependency-free constraint. It does not enforce code style (quotes, semicolons, etc.) — that's out of scope here, since a real style linter (ESLint/Prettier) would require npm.

## Changes

### `jsconfig.json` (new, repo root)

```json
{
  "compilerOptions": {
    "checkJs": true,
    "noEmit": true,
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "strict": false
  },
  "include": ["*.js"]
}
```

- `checkJs: true` — the core switch that turns on type-checking for `.js` files.
- `strict: false` — full strict mode (`noImplicitAny`, `strictNullChecks`, etc.) would surface hundreds of pre-existing "implicit any" warnings across ~1200 untyped lines, none of which are real bugs. Kept off so the signal stays focused on actual mistakes.
- `noUnusedLocals` / `noUnusedParameters: true` — these don't require type annotations to work, and directly catch dead code/typos, which is the main value we're after.
- `lib: ["ES2020", "DOM"]` — resolves browser globals (`document`, `window`, `localStorage`, etc.) used throughout `app.js`.
- `include: ["*.js"]` — scopes checking to the two root-level JS files (`app.js`, `logic.test.js`); nothing under `docs/` is affected.

### `types.d.ts` (new, repo root)

`app.js` and `logic.test.js` use CommonJS `require()`/`module.exports` (for the Node test runner and for `app.js`'s dual browser/Node loading). Normally TypeScript would want `@types/node` (an npm package) to know about these globals. Instead, this file hand-declares just the two globals actually used, avoiding any install:

```ts
declare const require: (id: string) => any;
declare const module: { exports: any };
```

### `README.md` (modified)

Add a "Linting" section (after "Test", before "Deploy") documenting that type-checking is automatic in VS Code (Problems panel, no setup), plus an optional one-off terminal check for anyone who wants it:

```markdown
## Linting
Type-checking runs automatically in VS Code via `jsconfig.json` — open the project and check the Problems panel, no install needed.
Optional one-off terminal check: `npx tsc --noEmit -p jsconfig.json` (downloads TypeScript temporarily; requires network, not a permanent install).
```

## Verification

After adding `jsconfig.json` and `types.d.ts`, `app.js` and `logic.test.js` should show a clean Problems panel in VS Code (or only issues worth fixing as part of this same change — linting shouldn't ship already red). Since this sandbox has no Node/npm/VS Code available to run the check directly, the implementer will ask the user to open the two files in VS Code and report what appears in the Problems panel, then fix any real findings before considering the task done — the same manual-verification pattern used for the click-flash animation's browser QA.

## Out of scope

- Code style enforcement (ESLint/Prettier) — would require npm, contradicting the project's dependency-free constraint.
- `docs/**/*.md` files — not code, not linted.
- CI enforcement — no CI currently exists for this repo; adding one is a separate concern.
