# Plan: Markdown Notes Sidebar — Chrome Extension

## Context

We're building a Chrome extension (`chrome-notes-sidebar`) inspired by the "Note Sidebar"
extension. It lives in Chrome's **side panel** so it stays open across tab navigation, and lets
users write **GitHub-Flavored Markdown** notes that sync across their own Chrome browsers with no
account and no cloud backend of ours.

The product is modeled on **Google Tasks' interaction pattern, but for notes**: a dropdown at the
top to pick or create a note, and a **View / Edit** tab switch beside it — Edit shows a plain
markdown textarea, View renders the markdown. Notes auto-save (3s debounce) to
`chrome.storage.sync`.

Goal for the codebase: highly modular and maintainable so it can be (a) grown feature-by-feature
via small PRs and (b) published to the Chrome Web Store later. For now it ships as a
**load-unpacked** extension.

## Locked Decisions

| Area | Decision |
|---|---|
| UI surface | MV3 `chrome.sidePanel` (persistent side panel) |
| Storage | `chrome.storage.sync` — cross-device, no backend |
| Autosave | Debounced, **3 seconds** after typing stops |
| Note limit | **Max 10 notes**; selector shows `used / 10` |
| Per-note size | ~8 KB per sync item → show **char count (used / limit)**; block/warn near cap |
| Editor | Plain markdown textarea (Edit) + rendered GFM (View) |
| Markdown | **GFM** (headings, bold/italic, lists, links, code blocks, tables, task lists), sanitized |
| Layout | **Top:** note selector + View/Edit tabs. **Bottom-left:** tools (copy-all, info). **Bottom-right:** char counter. |
| Testing | Dedicated `tests/` dir; **unit-test every meaningful function** (Vitest) |
| v1 extras | Dark mode/theme, configurable keyboard shortcut |
| Deferred | Export/import, search, TTS, password lock, Web Store publish assets |
| Stack | Svelte + Vite + TypeScript |
| Lint/format | **Biome** (config added in PR 2; rules TBD together) |
| Distribution | Load unpacked now; keep store-publish-ready |

### Storage sizing math (why the caps exist)
`chrome.storage.sync` limits: ~100 KB total, ~8 KB per item, 512 items, 120 writes/min. Design:
- One sync item **per note** keyed `note:<id>` (≤ ~8 KB each) → the per-note char budget.
- One `notes:index` item holding ordered list of `{id, title, updatedAt}` (well under 8 KB for 10).
- 10 notes × 8 KB + index ≈ 88 KB < 100 KB total.
- 3s debounce keeps us far under the write-rate limit.

## Architecture (modular seams)

```
src/
  manifest.config.ts        # manifest authored in TS (CRXJS), MV3
  background.ts             # service worker: setPanelBehavior, command -> sidePanel.open
  sidepanel/
    index.html
    main.ts                 # mounts App.svelte
    App.svelte              # layout: [top: selector + tabs] [middle: editor|view] [bottom: tools / counter]
  lib/
    storage/
      NotesRepository.ts    # INTERFACE: list/get/create/rename/delete/save  <-- swap seam
      SyncNotesRepository.ts# chrome.storage.sync implementation
      limits.ts             # MAX_NOTES=10, per-note byte budget, char<->byte helpers
    markdown/
      render.ts             # GFM -> sanitized HTML (marked + DOMPurify)
    stores/
      notes.ts              # Svelte store: notes index + current note + save state
      theme.ts              # light/dark store, syncs OS pref + persisted choice
    util/debounce.ts
  components/
    NoteSelector.svelte     # top-left: dropdown (select/create), "used / 10" badge
    ViewEditTabs.svelte     # top: View / Edit tabs
    MarkdownEditor.svelte   # middle: plain markdown textarea
    MarkdownView.svelte     # middle: renders sanitized GFM
    UtilityBar.svelte       # bottom-LEFT: copy-all, info popover
    CharCounter.svelte      # bottom-RIGHT: char count (used / limit)
  styles/                   # theme tokens (CSS vars) for light/dark
tests/                      # Vitest — mirrors src/, one spec per meaningful module
```

Key modularity principle: **all persistence goes through `NotesRepository`**. `SyncNotesRepository`
is the only file that touches `chrome.storage.sync`, so swapping to a local or future cloud backend
is a one-file change.

Libraries: `marked` (GFM) + `DOMPurify` (sanitize rendered HTML). CRXJS (`@crxjs/vite-plugin`) for
the MV3 build + HMR.

## Work breakdown (one task = one PR)

**PR 1 — Scaffold + open sidebar + edit (larger, foundational)**
- Vite + Svelte + TS + CRXJS; MV3 manifest (`side_panel`, `storage` perm, `action`, background SW).
- `background.ts`: `setPanelBehavior({ openPanelOnActionClick: true })`.
- Placeholder icons; single-note Edit/View panel; 3s debounced save to `chrome.storage.sync`.
- `NotesRepository` interface + `SyncNotesRepository`.
- Repo docs (`plan.md`, `CLAUDE.md`, `README.md`); Vitest + specs.

**PR 2 — Multi-note management + Biome**
- `notes:index` model; selector create/select/rename/delete; `MAX_NOTES=10` + `used/10`.
- Add Biome (linter/formatter); agree rules; document in CLAUDE.md.

**PR 3 — Char budget & quota UX**
- `CharCounter` bottom-right (used / limit); warn/block near per-note byte cap; graceful quota errors.

**PR 4 — Utility bar (bottom-left)**
- Copy-all-text; Info popover (last updated, char count, note count).

**PR 5 — Dark mode / theme**
- CSS-variable tokens; follow OS `prefers-color-scheme`; persisted manual toggle.

**PR 6 — Keyboard shortcut**
- `commands` in manifest; background handler `sidePanel.open({ windowId })`.

**Deferred:** export/import, search, Web Store publish package.

## Verification

Per PR, manual E2E in Chrome: `npm run build` → `chrome://extensions` → Developer mode → Load
unpacked → exercise the PR's acceptance criteria → confirm persistence across reloads.

**Unit tests are a first-class deliverable of every PR.** All tests live in `tests/` (mirroring
`src/`), run with Vitest. Every meaningful function gets a spec; each PR lands with `npm test` green.
