# Remember the last opened note

> Roadmap item: "Remember the last opened note." This is its own small PR, independent of
> [single-open-popover.md](./single-open-popover.md) (no ordering dependency between them; whichever
> lands second only needs a trivial rebase of `App.svelte`/docs).

## Why?

Every time the side panel opens, `App.svelte`'s `onMount` loads **`notes[0]`** — the first note in the
index — regardless of which note the user was actually working in. If you spend the afternoon in your
third note, close the panel (or restart Chrome), and reopen, you're dropped back on note #1 and have to
re-select. For a tool whose whole point is quick capture/reference, that friction is felt on every
reopen. The panel should reopen **where you left off**: the note you last had open.

The extension already restores "where you left off" for the search page via
`SessionSearchStateRepository`; this closes the same loop for the selected note.

## What?

When done:

- The **id of the currently open note is remembered** and, on the next panel open, that note is loaded
  instead of always `notes[0]`.
- It **survives a full browser restart** (durable), because it's stored in the synced settings item
  (see **Decisions**), not session storage.
- **Fallbacks are graceful:** if the remembered id no longer exists (note deleted, or a backup import
  reassigned ids) or nothing has been remembered yet (fresh install), the panel falls back to
  `notes[0]` exactly as today. An empty store still creates the default first note (`firstOrCreate`).
- The remembered id **self-heals**: after any fallback, the newly shown note becomes the remembered
  one, so a stale pointer corrects itself on the next selection.

**In scope:** adding a `lastNoteId` field to the `Settings` shape, persisting it whenever the current
note changes, restoring it on mount, the fallback logic, and unit tests for the settings normalization.

**Out of scope:** remembering the editor **mode** (edit/view) per note — the existing
view-on-switch preference (`resolveViewMode`) still decides the mode on open. Remembering scroll
position or cursor. Any new storage area or repository seam (reuse the settings seam). Stripping
`lastNoteId` from exported backups (explicitly decided against — see **Decisions**).

## Decisions

Locked during specification. Do not relitigate:

- **Store `lastNoteId` inside `Settings` (`chrome.storage.sync`), reusing `SyncSettingsRepository`.**
  Rationale: chosen by the user for simplicity — no new storage area or repository. It is durable
  across browser restarts. In this app notes themselves sync across a user's devices, so a synced
  cursor usually points at a note that exists on the other device too; where it doesn't (import with
  new ids, or a note deleted elsewhere), the fallback covers it.
- **No exception for backups — `lastNoteId` rides inside the exported/imported JSON like any other
  settings field.** Rationale: the user explicitly chose not to special-case it. On import into a
  different note set the id simply won't match and restore falls back to `notes[0]`, then self-heals.
  So `buildBackup` / `parseBackup` need **no** changes.
- **Restore on mount, persist on note change via a hydration-guarded `$effect`.** Rationale: mirrors
  the existing search-state restore pattern in `App.svelte` (`searchHydrated`), so a note-change write
  can't fire during startup restore and clobber the stored value with a default.
- **Fall back to `notes[0]` for a missing/unknown/first-run id; keep `firstOrCreate` for an empty
  store.** Rationale: preserves today's exact behavior whenever there's nothing valid to restore.
- **Do not remember editor mode** — `resolveViewMode(settings.view, mode)` continues to decide the
  mode. Rationale: out of scope; mode is a separate preference already.

## How?

Follow the repo seams: the `Settings` type + normalization are pure (`src/lib/settings/settings.ts`,
unit-tested); persistence stays behind `SyncSettingsRepository`; `App.svelte` orchestrates.

### 1. `src/lib/settings/settings.ts` — add the field

- Extend the interface with an **optional** id:
  ```ts
  export interface Settings {
    theme: ThemePref;
    view: ViewPref;
    /** Id of the note last opened, restored on panel open. Device cursor; may be stale. */
    lastNoteId?: string;
  }
  ```
- `DEFAULT_SETTINGS` stays `{ theme: "system", view: "persistent" }` (no `lastNoteId`).
- In `normalizeSettings`, carry a **string** `lastNoteId` through and **omit it otherwise** (do not set
  it to `undefined`). Build the result so absent/invalid input yields an object with just `theme` and
  `view`:
  ```ts
  const result: Settings = { theme, view };
  if (typeof raw?.lastNoteId === "string" && raw.lastNoteId.length > 0) {
    result.lastNoteId = raw.lastNoteId;
  }
  return result;
  ```
  This keeps stored objects clean and keeps the existing `toEqual({ theme, view })` tests passing (see
  **Caveats**).

### 2. `src/sidepanel/App.svelte` — restore on mount, persist on change

- **Restore (in `onMount`):** `settings` is fetched first, then `refreshList()` populates `notes`.
  Replace the `else { await loadNote(notes[0].id); }` branch of the existing empty-vs-nonempty check
  with a resolved target:
  ```ts
  } else {
    const savedId = settings.lastNoteId;
    const targetId = savedId && notes.some((n) => n.id === savedId) ? savedId : notes[0].id;
    await loadNote(targetId);
  }
  ```
  Leave the `notes.length === 0` branch (which calls `repo.firstOrCreate()`) unchanged.
- **Hydration guard:** add `let noteHydrated = $state(false);` and set it `true` at the end of
  `onMount` (after the note is restored — alongside or near the existing `searchHydrated = true`).
- **Persist on change:** add an `$effect` that writes the current note id into settings whenever it
  changes, but only after hydration and only when it actually differs:
  ```ts
  $effect(() => {
    const id = current?.id;              // track it so the effect subscribes
    if (!noteHydrated || !id) return;
    if (settings.lastNoteId === id) return; // no redundant sync write
    saveSettings({ ...settings, lastNoteId: id });
  });
  ```
  Reuse the existing `saveSettings(next)` helper (it sets `settings` and calls `settingsRepo.save`).
  This single effect covers every path that changes the current note: `selectNote`, `createNote`,
  `deleteNote`→`selectFirstNote`, and `importBackup`→`selectFirstNote` (which self-heals a
  non-matching imported `lastNoteId`).

No changes to `SyncSettingsRepository.ts` or `backup.ts` are required — `lastNoteId` flows through
`normalizeSettings` on both save and parse.

### 3. Docs

- Note in `docs/overview.md` ("What it does today") that the panel reopens on the last note.
- In `docs/decisions.md`, the settings row can gain a short note that `settings` also holds a
  device-cursor `lastNoteId`.
- Tick / annotate this item in `docs/roadmap/index.md`.

## Caveats

- **Keep existing `normalizeSettings` tests green.** `tests/settings/settings.spec.ts` asserts
  `normalizeSettings({ theme: "dark", view: "view" })` `toEqual({ theme: "dark", view: "view" })` and
  that defaults come back for empty input. Omitting `lastNoteId` when it's absent (rather than setting
  it to `undefined`) keeps these exact-shape assertions passing.
- **Avoid redundant sync writes.** The persist `$effect` must early-return when
  `settings.lastNoteId === current.id`; otherwise it rewrites the settings item on every reactive tick.
  Note-switch frequency is far under the sync write-rate cap, but only write on an actual change.
- **The hydration guard is essential.** Without `noteHydrated`, the effect fires as `current` is set
  during `onMount` restore and could write before/despite the restore. Gate it exactly like the search
  hydration already gates its persist effect.
- **Deleted / imported-away ids must not throw.** Restoration only loads the saved id when
  `notes.some((n) => n.id === savedId)`; otherwise `notes[0]`. After a fallback, the persist effect
  overwrites `lastNoteId` with the shown note, healing the stale value.
- **`lastNoteId` in backups is intentional.** Reviewers may flag a device cursor appearing in exported
  JSON — that was an explicit decision (simplicity; the fallback makes a non-matching id harmless).
  Don't "fix" it by stripping it from `backup.ts`.
- **Don't persist mode.** Restoring the note must still run the note through the normal open path so
  `resolveViewMode(settings.view, mode)` picks the mode; don't add per-note mode memory.
- **Interaction with search restore.** `onMount` may also re-open search (existing behavior). Restoring
  the last note loads it *underneath*; search overlays as before. Restore the note first, then the
  existing search-restore block runs — no conflict.

## Relevant tests

Pure settings logic is unit-tested; the mount/restore wiring in `App.svelte` is verified by manual
E2E, per `CLAUDE.md`.

**Extend `tests/settings/settings.spec.ts`:**
- `normalizeSettings({ theme: "dark", view: "view", lastNoteId: "abc" })` keeps `lastNoteId: "abc"`.
- A non-string / empty `lastNoteId` (e.g. `123`, `""`, `null`) is **dropped**: the result has no
  `lastNoteId` key (`expect("lastNoteId" in normalizeSettings(...)).toBe(false)`), and existing
  empty-input cases still `toEqual(DEFAULT_SETTINGS)`.
- `lastNoteId` is normalized independently of `theme`/`view` (a valid id survives even when
  `theme`/`view` are corrupt and fall back to defaults).

**Commands (all must be green):**
```
npm test          # Vitest — extended settings spec + existing suite
npm run check     # svelte-check
npm run lint      # Biome
npm run build     # production build into dist/
```

**Manual E2E (load `dist/` unpacked, per `CLAUDE.md` → "Load the extension"):**
1. Create/select a non-first note, type in it, close the panel, reopen → the same note is shown (not
   note #1).
2. Restart Chrome entirely, reopen the panel → still the last note (durable across restart).
3. Delete the remembered note → the panel falls back to the first note without error; close/reopen →
   that first note is now remembered.
4. Fresh profile / cleared storage → the default first note is created and shown (no crash).
5. Export a backup, import it on a store with different notes → opens the first note (the imported
   `lastNoteId` doesn't match), then remembers your next selection.
6. Changing theme / view-on-switch in settings still works and does not disturb the remembered note.
