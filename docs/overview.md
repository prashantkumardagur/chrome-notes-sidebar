# Overview

A Chrome MV3 extension: a **Markdown notes editor in the browser side panel**. Notes sync
across a user's own Chrome browsers via `chrome.storage.sync` — **no account, no backend of
ours**. Interaction model = Google Tasks, but for notes.

## What it does today
- Persistent **side panel** (`chrome.sidePanel`), opened from the toolbar icon.
- **Multiple notes** (max 10): a dropdown selector with create / rename / delete and a `used/10` count.
- **Markdown** editor with **View / Edit** tabs; View renders sanitized **GFM** (headings,
  emphasis, lists, links, code, tables, task lists); raw embedded HTML shows as plain text.
- **Formatting toolbar** in Edit mode (bold, italic, link, inline code, heading, bulleted list) plus
  `Cmd/Ctrl+B/I/K` shortcuts scoped to the editor; wraps/unwraps the selection (toggle) and flows
  through the same autosave as typing.
- **Autosave** to `chrome.storage.sync`, 3s debounced — cross-device, no account.
- **Per-note character budget** with a live `used/limit` counter and a save-state dot (Saving / Saved).
- **Note info popover** (ⓘ) with last-edited time, character/word/line counts, and note usage.
- **Cross-note search** (🔍 in the note actions, or Cmd/Ctrl+`/`): live regex search over every
  note's body (case-insensitive by default, with an `Aa` match-case toggle), results grouped by note;
  click a result to open that note and jump to the match (selected in Edit mode, highlighted +
  scrolled to in View mode).
- **Reopens on the last note** you had open (remembered in synced settings), falling back to the
  first note if that note no longer exists.

Next and deferred work: [roadmap](./roadmap/index.md). Why it's built this way: [decisions.md](./decisions.md).

## Stack
Svelte 5 · Vite 8 · TypeScript · CRXJS (MV3 build/HMR) · `marked` + `DOMPurify` (GFM, sanitized) ·
Biome (lint/format) · Vitest (unit tests).

## Constraints / non-goals
- No cloud backend and no account — persistence is Chrome's `storage.sync` only.
- Stay **MV3 / Chrome-Web-Store-publishable**: least-privilege permissions, no remote code.
