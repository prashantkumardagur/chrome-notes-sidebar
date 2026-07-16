# Architecture

Entry points: `src/background.ts` (service worker) and `src/sidepanel/` (the panel UI).
The code is the source of truth — this is just the map.

## Where to find things
```
src/
  manifest.config.ts        MV3 manifest (CRXJS), authored in TS
  background.ts             service worker: opens the side panel on toolbar-icon click
  sidepanel/
    index.html, main.ts     panel document + Svelte mount
    App.svelte              top-level state + layout orchestration (load/select/save notes)
    app.css                 theme tokens (CSS vars, light/dark)
  components/
    NoteSelector.svelte     note dropdown: select / create / rename / delete + count
    ViewEditTabs.svelte     View / Edit switch
    MarkdownEditor.svelte   plain markdown textarea (enforces maxlength)
    MarkdownView.svelte     renders sanitized GFM
    CharCounter.svelte      used/limit counter, warns near cap
  lib/
    storage/
      NotesRepository.ts       interface — the storage seam
      SyncNotesRepository.ts   chrome.storage.sync implementation
      limits.ts                all caps + byte/char math
    markdown/render.ts         GFM -> sanitized HTML
    util/debounce.ts           trailing-edge debounce (autosave)
    notes/title.ts             default/normalized note titles
tests/                         Vitest, mirrors src/ (one spec per meaningful module)
```

## Seams to respect
- **Persistence only via `NotesRepository`.** `SyncNotesRepository` is the *only* file that
  touches `chrome.storage.*` — swapping/adding a backend is a one-file change.
- **All caps/limits live in `limits.ts`** (note count, per-note byte + character budgets).
- **Markdown is always sanitized** in `render.ts` (DOMPurify); note content is untrusted.

## Storage layout (`chrome.storage.sync`)
- `notes:index` → ordered `NoteMeta[]` (`{id, title, updatedAt}`).
- `note:<id>` → one full `Note` per note.

## UI layout contract (don't drift)
- **Top:** note selector (left) + View / Edit tabs (right).
- **Middle:** Markdown textarea (Edit) or rendered GFM (View).
- **Bottom-left:** tools (copy-all, info popover) — *planned*.
- **Bottom-right:** save-state dot + character counter (`used/limit`).
