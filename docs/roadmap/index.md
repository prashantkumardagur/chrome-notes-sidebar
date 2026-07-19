# Roadmap

What's left to build, roughly in priority order. Completed work lives in git history — this file
lists only **upcoming** and **deferred** work. Each item is one small PR (except where a spec notes it
may stage into two). Each queued item links to its task spec; task dependencies are listed as
sub-points.

## Next Tasks

Each has a self-contained spec in this directory:

* [Interactive task lists](./interactive-task-lists.md) — tick `- [ ]`/`- [x]` checkboxes in View
  mode, writing back to the note.
* [Organize notes: sort + reorder](./organize-notes.md) — a dedicated surface to sort notes
  (Manual / Title A–Z / Last edited) and manually reorder (drag + keyboard). Covers the old "Reorder
  notes" and "Sort notes" items. (Adds a `sortMode` field to synced settings **data**, but its UI is in
  the notes dropdown — no dependency on the settings-page revamp.)
* [Editor preferences](./editor-preferences.md) — font size, line spacing, editor font (mono/sans),
  and word-wrap, added to the settings UI; synced.
* [Markdown cheat sheet](./markdown-cheat-sheet.md) — a collapsible GFM syntax reference in the ⓘ info
  popover.
* [More keyboard shortcuts](./more-shortcuts.md) — in-panel shortcuts for the common actions
  (toggle view/settings/info, new note, cycle notes) behind one keymap; folds in the existing search
  shortcut.

## Deferred

* Password protection
* Pin notes: a per-note pin that floats notes above the active sort order — revisit after
  [Organize notes](./organize-notes.md) ships (manual reorder may already cover the need).
