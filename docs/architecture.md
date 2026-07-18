# Architecture

Entry points: `src/background.ts` (service worker) and `src/sidepanel/` (the panel UI).
The code is the source of truth — this is just the map.

## Where to find things
```
src/
  manifest.config.ts        MV3 manifest (CRXJS), authored in TS
  background.ts             service worker: opens the panel on icon click + toggles it on the keyboard command
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
    SettingsPanel.svelte    settings page: theme + view-on-switch prefs + backup export/import
                            (opened via the footer gear; replaces the editor area, like search)
    SearchPanel.svelte      search mode: input + grouped/emphasized results (replaces the editor area)
  lib/
    backup/backup.ts          build/serialize/parse a full notes+settings JSON backup
    storage/
      NotesRepository.ts       interface — the notes storage seam
      SyncNotesRepository.ts   chrome.storage.sync implementation
      limits.ts                all caps + byte/char math
    settings/
      SettingsRepository.ts    interface — the settings storage seam
      SyncSettingsRepository.ts chrome.storage.sync implementation
      settings.ts              types, defaults, theme apply + view-mode resolution
    commands/panelToggle.ts    keyboard-command handler (toggles the side panel open/closed)
    search/
      search.ts                pure body-only regex search (case toggle, offsets + line snippets, iteration guard)
      highlight.ts             jump-to-match: textarea select (edit) + rendered-DOM <mark>s (view)
      searchState.ts           search-UI session state type + normalize
      SessionSearchStateRepository.ts  chrome.storage.session store (restores search on panel reopen)
    markdown/render.ts         GFM -> sanitized HTML
    ui/surfaces.ts             single-active-surface coordination — which transient popover/search page is open
    util/debounce.ts           trailing-edge debounce (autosave)
    util/time.ts               relative "last edited" formatting
    notes/title.ts             default/normalized note titles
    notes/stats.ts             pure word/line count for the info popover
tests/                         Vitest, mirrors src/ (one spec per meaningful module)
```

## Seams to respect
- **Persistence only via a repository.** `SyncNotesRepository` (notes),
  `SyncSettingsRepository` (settings), and `SessionSearchStateRepository` (ephemeral search-UI
  state) are the *only* files that touch `chrome.storage.*` — one storage-owning file per domain.
  The first two use the synced area (cross-device, durable); the search-state store uses the
  **session** area on purpose: it restores "where you left off" on panel reopen but must not sync
  across devices or outlive the browser session.
- **All caps/limits live in `limits.ts`** (note count, per-note byte + character budgets).
- **Markdown is always sanitized** in `render.ts` (DOMPurify); note content is untrusted.
- **Backup import is a full replace**, not a merge: `NotesRepository.replaceAll` swaps the entire
  note set (writing the new set before removing anything stale, so a failed write can't wipe
  existing notes). `parseBackup` sanitizes/caps untrusted import data and rejects anything whose
  `version` doesn't match `BACKUP_VERSION`. Known limitation of the write-before-delete ordering:
  because ids rarely overlap, storage briefly holds both the old and new note sets, so importing a
  large backup over an already-large store can transiently exceed the ~100 KB sync total and fail —
  safely, leaving existing notes intact (data loss is the worse failure, hence the ordering).

## Storage layout
`chrome.storage.sync` (durable, cross-device):
- `notes:index` → ordered `NoteMeta[]` (`{id, title, updatedAt}`).
- `note:<id>` → one full `Note` per note.
- `settings` → `{ theme, view }` (see `settings.ts`).

`chrome.storage.session` (in-memory, per browser session):
- `search:state` → `{ active, query, collapsed[], caseSensitive }` — the search page to restore on panel reopen.

## UI layout contract (don't drift)
- **Top:** note selector (left) + View / Edit tabs (right).
- **Middle:** Markdown textarea (Edit) or rendered GFM (View) — or, while a transient surface is
  active, that surface's full-page content (search results, settings) replacing the editor/view.
- **Bottom-left:** tools (copy-all, info popover) + a standalone settings gear (toggles the
  settings page; footer/topbar stay visible while it's open).
- **Bottom-right:** save-state dot + character counter (`used/limit`).
