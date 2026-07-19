# Overview

A Chrome MV3 extension: a **Markdown notes editor in the browser side panel**. Notes sync
across a user's own Chrome browsers via `chrome.storage.sync` — **no account, no backend of
ours**. Interaction model = Google Tasks, but for notes.

## What it does today
- Persistent **side panel** (`chrome.sidePanel`), opened from the toolbar icon.
- **Multiple notes** (max 10): a dropdown selector with create / rename / delete and a `used/10` count.
  Creating from the **New note** button opens the name in rename mode (with the text preselected);
  the new-note **shortcut** keeps "Untitled" and drops the cursor straight into the editor. Finishing a
  rename (Enter / ✓) returns focus to the editor when in Edit mode.
- **Markdown** editor with **View / Edit** tabs; View renders sanitized **GFM** (headings,
  emphasis, lists, links, code, tables, task lists) with syntax-highlighted fenced code for an
  explicit language; raw embedded HTML shows as plain text. Task-list checkboxes are **tickable in
  View mode** — clicking one flips `[ ]`↔`[x]` in the note and autosaves.
- **Formatting toolbar** in Edit mode (bold, italic, link, inline code, heading, bulleted list) plus
  `Cmd/Ctrl+B/I/K` shortcuts scoped to the editor; wraps/unwraps the selection (toggle) and flows
  through the same autosave as typing. `Tab`/`Shift+Tab` indent/outdent by 2 spaces instead of
  moving focus.
- **Autosave** to `chrome.storage.sync`, 3s debounced — cross-device, no account.
- **Per-note character budget** with a live `used/limit` counter and a save-state dot (Saving / Saved).
- **In-panel keyboard shortcuts** (active while the side panel has focus): Search (`⌘/Ctrl+/`),
  toggle Edit/View (`⌘/Ctrl+Shift+E`), Settings (`⌘/Ctrl+,`), Info (`⌘/Ctrl+.`), new note
  (`⌘/Ctrl+Shift+A`), rename note (`⌘/Ctrl+Shift+R`), and previous/next note
  (`⌘/Ctrl+Shift+,` / `⌘/Ctrl+Shift+.`, wrapping). Driven by one keymap
  (`src/lib/shortcuts/keymap.ts`) that also backs the popover reference.
- **Note info popover** (ⓘ) with last-edited time, character/word/line counts, note usage, a
  keyboard-shortcuts reference (toggle panel — live rebound key — plus the in-panel
  shortcuts above and Close surface), and a **Markdown cheat sheet** (GFM syntax → result
  reference for the supported syntax) — both shown as always-visible sections.
- **Cross-note search** (🔍 in the note actions, or Cmd/Ctrl+`/`): live regex search over every
  note's body (case-insensitive by default, with an `Aa` match-case toggle), results grouped by note;
  click a result to open that note and jump to the match (selected in Edit mode, highlighted +
  scrolled to in View mode).
- **Organize notes** ("Organize notes" in the dropdown): a dedicated page to pick a sort field —
  **Manual** (custom order), **Title (A–Z)**, or **Last edited** — and, in Manual mode, reorder notes
  by drag-and-drop or keyboard (↑/↓ to move focus, Shift+↑/↓ to move a note). The choice is synced;
  an auto-sort field rewrites the stored order and the dropdown reflects it.
- **Editor preferences** in Settings — font size (S/M/L) and line spacing (comfortable/compact) for
  both Edit and View, plus an editor font (mono/sans) and word-wrap toggle for the Edit textarea;
  synced and applied live via CSS variables.
- **Reopens on the last note** you had open (remembered in synced settings), falling back to the
  first note if that note no longer exists.

Next and deferred work: [roadmap](./roadmap/index.md). Why it's built this way: [decisions.md](./decisions.md).

## Stack
Svelte 5 · Vite 8 · TypeScript · CRXJS (MV3 build/HMR) · `marked` + `DOMPurify` (GFM, sanitized) ·
Biome (lint/format) · Vitest (unit tests).

## Constraints / non-goals
- No cloud backend and no account — persistence is Chrome's `storage.sync` only.
- Stay **MV3 / Chrome-Web-Store-publishable**: least-privilege permissions, no remote code.
