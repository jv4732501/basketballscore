# Fix Stale Team Selection on Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Setup's cached team selection (`setupDraft.myTeamId`) no longer matches any team in `state.teams`, self-heal to the first available team (and its full roster) instead of silently showing an empty roster under a phantom selection.

**Architecture:** One validation check added at the top of `renderSetup()` in `app.js`.

**Tech Stack:** Vanilla JS (`app.js`), no build step.

## Global Constraints

- No change to `defaultDraft()` itself, the dropdown's `onchange` handler, or any other Setup behavior.
- A *valid* `d.myTeamId` (matching any existing team, not just the first) must be left untouched — only the broken case (no match) gets corrected.

---

### Task 1: Self-heal `d.myTeamId` in `renderSetup()`

**Files:**
- Modify: `app.js` (`renderSetup()` function, right after `setupDraft` is ensured to exist)

**Interfaces:** N/A — this is the only task in the plan; pure behavior addition, nothing here is consumed by other tasks.

- [ ] **Step 1: Add the self-heal check**

Find:

```js
function renderSetup() {
  if (!setupDraft) setupDraft = defaultDraft();
  const d = setupDraft;
```

Replace with:

```js
function renderSetup() {
  if (!setupDraft) setupDraft = defaultDraft();
  const d = setupDraft;
  if (!state.teams.some((t) => t.id === d.myTeamId)) {
    d.myTeamId = state.teams[0]?.id ?? null;
    d.activePlayerIds = state.teams[0] ? state.teams[0].players.map((p) => p.id) : [];
  }
```

- [ ] **Step 2: Verify scope**

Run: `git diff app.js`
Expected: exactly the 4 new lines shown above, inserted right after `const d = setupDraft;` in `renderSetup()`. No other line in the file differs.

- [ ] **Step 3: Run the test suite to confirm no behavior change**

Run: `node --test 2>&1 | tail -8`
Expected: `tests 63`, `pass 63`, `fail 0` — `renderSetup`/`setupDraft`/`defaultDraft` are DOM-rendering "shell" functions, not part of `app.js`'s exported pure-logic surface, so this confirms nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "Fix stale team selection on Setup after creating or deleting a team"
```

- [ ] **Step 5: Manual verification (deferred to the user)**

There is no automated test for this (`renderSetup` is DOM-driven, not a pure function — no test coverage applies, matching the precedent for all prior UI-behavior fixes this session). Since this sandbox has no browser available, ask the user to verify in the actual app:

1. With zero teams, go to Setup (dropdown/roster area shows "No teams yet"). Go to Teams, create a team with a few players, save. Switch back to Setup ("New game" tab) — the new team's full roster should now show, all checked.
2. With one existing team already correctly selected on Setup, create a *second* team via the Teams tab, then switch back to Setup — the first team should remain selected with its roster intact (not reset to the new team).
3. Delete the team currently selected on Setup (via the Teams tab), then switch back to Setup — it should fall back to showing the next available team's roster (or "No teams yet" if none remain), not an empty roster under a phantom selection.
