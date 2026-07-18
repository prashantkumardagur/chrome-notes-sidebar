# Roadmap

What's left to build, roughly in priority order. Completed work lives in git history — this file
lists only **upcoming** and **deferred** work. Each item is one small PR (except where a spec notes it
may stage into two). Each queued item links to its task spec.

## Next Tasks

Each has a self-contained spec in this directory:

* [Editor formatting toolbar](./formatting-toolbar.md) — bold/italic/link/code/heading/list toolbar in
  the editor + `Cmd/Ctrl+B/I/K`, wrapping the textarea selection.
* [Render raw HTML as text](./render-html-as-text.md) — embedded HTML in a note renders as literal
  text, not live markup (defense-in-depth + predictable rendering). **Prerequisite for interactive
  task lists.**
* [Interactive task lists](./interactive-task-lists.md) — tick `- [ ]`/`- [x]` checkboxes in View
  mode, writing back to the note. **Depends on render-html-as-text.**
* [Organize notes: sort + reorder](./organize-notes.md) — a dedicated surface to sort notes
  (Manual / Title A–Z / Last edited) and manually reorder (drag + keyboard). Covers the old "Reorder
  notes" and "Sort notes" items.
* [Code block syntax highlighting](./code-syntax-highlighting.md) — bundled, explicit-language
  highlighting for fenced code in View, themed for light/dark (MV3-safe, no remote).
* [Editor preferences](./editor-preferences.md) — font size, line spacing, editor font (mono/sans),
  and word-wrap in the settings gear; synced.
* [Note stats](./note-stats.md) — word count + line count in the ⓘ info popover.
* [Markdown cheat sheet](./markdown-cheat-sheet.md) — a collapsible GFM syntax reference in the ⓘ info
  popover.

## Deferred

* Password protection
* Pin notes: a per-note pin that floats notes above the active sort order — revisit after
  [Organize notes](./organize-notes.md) ships (manual reorder may already cover the need).
