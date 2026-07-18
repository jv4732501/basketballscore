# Export/Import Backups of Team and Game Data

## Problem

All HoopScore data (saved teams, game history, any in-progress game) lives only in this
browser's `localStorage` (`hoops.teams`, `hoops.game`, `hoops.history`). Clearing browser
data — which the user sometimes needs to do — silently destroys everything. There is no way
to get the data out of the browser or bring it back in.

## Goal

One-tap **Export** of all app data to a single `.json` file the user can keep anywhere
(Files, email, Downloads), and an **Import** that restores it after a wipe or carries it to
another device. Works on both phone (share sheet) and desktop (file download / file picker).

## Backup file format

One JSON object:

```json
{
  "app": "hoopscore",
  "formatVersion": 1,
  "exportedAt": "2026-07-17T14:30:00.000Z",
  "teams": [],
  "history": [],
  "game": null
}
```

- `teams` / `history` / `game` are `state.teams`, `state.history`, and the in-progress
  `state.game` (or `null`), exactly as already serialized to `localStorage` today.
- `app: "hoopscore"` marks the file so import can reject arbitrary JSON with a clear error.
- `formatVersion: 1` lets a future version change the shape without breaking old backups;
  import additionally runs every game through the existing `migrateGame`, which already
  handles legacy game shapes.
- Theme is deliberately excluded — it is a device preference, not data.
- Filename: `hoopscore-backup-YYYY-MM-DD.json` (date-stamped so multiple backups sort).

## Export flow

New pure function **`buildBackup(state, nowMs)`** → returns the backup object above
(`exportedAt` derived from `nowMs`, never `Date.now()` inside, per project convention).

The Export button's handler serializes it and delivers the file:

- If `navigator.canShare({ files: [file] })` → `navigator.share({ files, title })` — the
  same share-sheet path the summary screen's Share button already uses (save to Files,
  AirDrop, email, etc.).
- Otherwise → Blob + temporary `<a download>` click (desktop Downloads folder).

Export never mutates state: no log entry, no `commit()`, nothing to undo.

## Import flow

The Import button creates a hidden `<input type="file" accept="application/json,.json">`
on the fly (created per tap, not rendered, so the full-innerHTML re-render cycle can't
destroy it mid-use) and clicks it. On file selection, `FileReader.readAsText` → the
existing `deserialize` → then:

1. **Validate** — new pure function **`validateBackup(obj)`** returns
   `{ ok: true, backup }` or `{ ok: false, reason }`:
   - not an object or `obj.app !== 'hoopscore'` → "Not a HoopScore backup file."
   - `formatVersion > 1` → "This backup was made by a newer version of HoopScore."
   - `teams` / `history` default to `[]` if absent; non-array values are rejected.
   - `game` defaults to `null`.
2. **Migrate** — every game in `history`, and `game` if present, goes through `migrateGame`.
3. **Merge** — new pure function **`mergeBackup(state, backup)`** returns
   `{ state, summary }` where `summary` counts what happened:
   - **Teams:** upsert by team `id` — new ids are appended, an existing id is overwritten
     by the file's version. Nothing local is deleted.
   - **History:** upsert by game `id` (same logic as the existing `upsertHistory`).
   - **In-progress game:** restored only if the local `state.game` is not resumable
     (`isResumable`) — importing never clobbers a game currently being scored. If both
     exist, the file's game is skipped and the summary says so.
4. **Save & render** — merged state replaces `state.teams` / `state.history` /
   `state.game`, then the normal `saveTeams()` / `saveHistory()` / `saveGame()` /
   `render()`.

**Feedback:** success → `alert` summarizing, e.g.
"Imported 3 teams (1 updated) and 12 games. In-progress game restored." /
"…skipped the backup's in-progress game (a game is already in progress here)."
Failure → `alert` with the specific reason; state is untouched. Import is all-or-nothing:
validation happens before any state is modified.

## UI

A small **Backup** block at the bottom of the Setup/home view: a muted section heading
("Backup") plus two side-by-side buttons, **Export data** and **Import data**, using
existing secondary-button classes and CSS variables (no new hardcoded colors, per the
theming rule). Rendered in `renderSetup`, wired in `wireSetup`, following the existing
render/wire pairing.

## Testing

`buildBackup`, `validateBackup`, and `mergeBackup` are pure functions added to the
module-export shim and covered TDD-first in `logic.test.js` (`node --test`):

- Round-trip: export from a populated state, import into an empty state → identical
  teams/history/game.
- Merge with id conflicts: file's version wins for the conflicting id; local-only and
  file-only items both survive.
- In-progress game rule: file's game restored when local has none; skipped (and flagged
  in the summary) when a local resumable game exists.
- Validation: garbage object, wrong `app`, `formatVersion: 2` all rejected with the right
  reason; missing `teams`/`history` default to empty.
- Migration: a backup containing a legacy-shaped game (e.g. old `reb` field) imports with
  `migrateGame` applied.

DOM plumbing (share sheet, blob download, FileReader, alerts) stays untested, matching the
codebase precedent for shell code.

Manual verification (user, on real devices):

1. Phone: tap Export → share sheet appears → Save to Files produces a dated `.json` with
   all teams/history.
2. Clear site data, then Import that file → teams and history are back; a finished game
   opens from History.
3. Desktop: Export downloads the file; Import restores it.
4. Import a second time (data already present) → no duplicates, counts reported as updates.
5. Import a non-backup `.json` → clear error, nothing changed.

## Out of scope (YAGNI)

Copy/paste text fallback, auto-backup reminders, selective export, theme in backups,
cloud sync.
