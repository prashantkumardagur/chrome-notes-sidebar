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
    UtilityBar.svelte       bottom-left tools: copy-all + info popover
    SettingsMenu.svelte     bottom-left gear: theme + view-on-switch prefs
  lib/
    storage/
      NotesRepository.ts       interface — the notes storage seam
      SyncNotesRepository.ts   chrome.storage.sync implementation
      limits.ts                all caps + byte/char math
    settings/
      SettingsRepository.ts    interface — the settings storage seam
      SyncSettingsRepository.ts chrome.storage.sync implementation
      settings.ts              types, defaults, theme apply + view-mode resolution
    markdown/render.ts         GFM -> sanitized HTML
    util/debounce.ts           trailing-edge debounce (autosave)
    util/time.ts               relative "last edited" formatting
    notes/title.ts             default/normalized note titles
tests/                         Vitest, mirrors src/ (one spec per meaningful module)
```

## Seams to respect
- **Persistence only via a repository.** `SyncNotesRepository` (notes) and
  `SyncSettingsRepository` (settings) are the *only* files that touch `chrome.storage.*` —
  swapping/adding a backend is a one-file change per domain.
- **All caps/limits live in `limits.ts`** (note count, per-note byte + character budgets).
- **Markdown is always sanitized** in `render.ts` (DOMPurify); note content is untrusted.

## Storage layout (`chrome.storage.sync`)
- `notes:index` → ordered `NoteMeta[]` (`{id, title, updatedAt}`).
- `note:<id>` → one full `Note` per note.
- `settings` → `{ theme, view }` (see `settings.ts`).

## UI layout contract (don't drift)
- **Top:** note selector (left) + View / Edit tabs (right).
- **Middle:** Markdown textarea (Edit) or rendered GFM (View).
- **Bottom-left:** tools (copy-all, info popover) + a standalone settings gear.
- **Bottom-right:** save-state dot + character counter (`used/limit`).
