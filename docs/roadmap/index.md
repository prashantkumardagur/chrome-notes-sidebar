# Roadmap

What's left to build, roughly in priority order. Completed work lives in git history — this file
lists only **upcoming** and **deferred** work. Each item is one small PR (except where a spec notes it
may stage into two). Each queued item links to its task spec; task dependencies are listed as
sub-points.

## Next Tasks

Each has a self-contained spec in this directory:

* [Editor formatting toolbar](./formatting-toolbar.md) — bold/italic/link/code/heading/list toolbar in
  the editor + `Cmd/Ctrl+B/I/K`, wrapping the textarea selection.
* [Render raw HTML as text](./render-html-as-text.md) — embedded HTML in a note renders as literal
  text, not live markup (defense-in-depth + predictable rendering).
* [Interactive task lists](./interactive-task-lists.md) — tick `- [ ]`/`- [x]` checkboxes in View
  mode, writing back to the note.
  * Depends on [Render raw HTML as text](./render-html-as-text.md).
* [Organize notes: sort + reorder](./organize-notes.md) — a dedicated surface to sort notes
  (Manual / Title A–Z / Last edited) and manually reorder (drag + keyboard). Covers the old "Reorder
  notes" and "Sort notes" items. (Adds a `sortMode` field to synced settings **data**, but its UI is in
  the notes dropdown — no dependency on the settings-page revamp.)
* [Revamp settings: popover → dedicated page](./settings-page.md) — move settings out of the gear
  popover into a full page like search/organize. Foundational for any task that adds settings UI.
* [Code block syntax highlighting](./code-syntax-highlighting.md) — bundled, explicit-language
  highlighting for fenced code in View, themed for light/dark (MV3-safe, no remote).
* [Editor preferences](./editor-preferences.md) — font size, line spacing, editor font (mono/sans),
  and word-wrap, added to the settings UI; synced.
  * Depends on [Revamp settings: popover → dedicated page](./settings-page.md) (adds controls to the
    settings UI).
* [Note stats](./note-stats.md) — word count + line count in the ⓘ info popover.
* [Markdown cheat sheet](./markdown-cheat-sheet.md) — a collapsible GFM syntax reference in the ⓘ info
  popover.
* [Keyboard shortcuts reference](./keyboard-shortcuts-reference.md) — a collapsible list of the app's
  current shortcuts in the ⓘ info popover (live toggle-key binding, per-platform modifiers).
* [More keyboard shortcuts](./more-shortcuts.md) — in-panel shortcuts for the common actions
  (toggle view/settings/info, new note, cycle notes) behind one keymap; folds in the existing search
  shortcut.
  * Coordinates with [Keyboard shortcuts reference](./keyboard-shortcuts-reference.md) (should display
    from the same keymap) — no hard ordering.

## Deferred

* Password protection
* Pin notes: a per-note pin that floats notes above the active sort order — revisit after
  [Organize notes](./organize-notes.md) ships (manual reorder may already cover the need).
