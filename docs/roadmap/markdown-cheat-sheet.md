# Markdown cheat sheet

> Roadmap item (Deferred): "Markdown cheat sheet: a quick GFM syntax reference in the info popover."
> Its own small PR. Coexists with [note-stats.md](./note-stats.md) (both add to the info popover) — if
> both land, the cheat sheet sits below the stats rows.

## Why?

Notes are written in Markdown, but the syntax isn't discoverable from the editor alone — a new user
doesn't know how to make a table, a task list, or a code block. A compact, always-available GFM
reference removes that guesswork without leaving the panel. It lives in the existing ⓘ info popover
(`UtilityBar.svelte`), which is already the "about this note / how things work" surface.

## What?

When done, the ⓘ info popover contains a **collapsible "Markdown cheat sheet"** section (below the
note-info rows). Expanding it shows a compact reference mapping **syntax → result** for the GFM the
renderer supports: heading, bold, italic, inline code, fenced code block, bulleted/numbered list, task
list, link, blockquote, and table. It is **static reference content** — no interactivity beyond
expand/collapse.

**In scope:** a collapsible cheat-sheet block in the info popover; concise syntax examples covering the
supported GFM; theming for light/dark; keyboard-accessible expand/collapse; docs.

**Out of scope:** click-to-insert snippets (that's the formatting toolbar's job); a full Markdown
tutorial; a separate help page/surface; anything dynamic or note-dependent.

## Decisions

Locked during specification. Do not relitigate:

- **A collapsible section inside the existing ⓘ info popover**, below the stats/info rows. Rationale:
  user's choice; reuses the existing note-facts/help surface rather than adding another button or
  surface. Collapsed by default so it doesn't crowd the popover.
- **Static content, expand/collapse only.** Rationale: it's a reference, not an editor; inserting
  syntax is covered by the formatting toolbar item.
- **Cover exactly the GFM the renderer supports** (`src/lib/markdown/render.ts`: headings, emphasis,
  code, fenced code, lists, task lists, links, blockquotes, tables). Rationale: don't document syntax
  the app won't render.
- **Use a native `<details>/<summary>`** for the collapse. Rationale: accessible and keyboard-operable
  with zero JS state; matches the app's lean, dependency-free UI.

## How?

### `src/components/UtilityBar.svelte`

- Inside the existing `{#if open}` info `.popover`, after the stats `<dl>`, add a `<details class="cheatsheet">`
  with a `<summary>Markdown cheat sheet</summary>` and a compact reference body.
- Structure the reference as a two-column list/grid (syntax on the left in a `<code>`, result/label on
  the right), e.g.:
  - `# Heading` → Heading
  - `**bold**` / `*italic*` → bold / italic
  - `` `code` `` → inline code
  - ```` ``` ```` fenced block → code block
  - `- item` / `1. item` → bullet / numbered list
  - `- [ ] task` → task list
  - `[text](url)` → link
  - `> quote` → blockquote
  - `| a | b |` (+ `| - | - |`) → table
- Show the literal syntax as text (escape `` ` `` and backticks appropriately so they display, not
  render). Keep it terse — the popover is `min-width: 180px`; allow it to widen a bit and/or scroll
  vertically (`max-height` + `overflow-y: auto`) if the content is tall.
- Theme with existing `--` tokens (`--text`, `--text-muted`, `--code-bg`, `--border`); ensure the
  `<code>` samples reuse the popover's monospace/code styling. Verify light and dark.

### Docs

- `docs/overview.md`: (optional) mention the in-panel Markdown cheat sheet.
- `docs/roadmap/index.md`: remove this item from Deferred.

## Caveats

- **Don't accidentally render the examples.** The syntax samples must display as literal characters
  (e.g. `**bold**` shown verbatim), not be interpreted — put them in `<code>`/escaped text, not through
  the Markdown renderer.
- **Popover size.** Adding a tall block to a small popover can overflow the panel bottom; the popover
  opens upward (`bottom: calc(100% + 6px)`). Cap its height and scroll internally so it never runs off
  the viewport.
- **Coexistence with note-stats.** If [note-stats.md](./note-stats.md) also lands, keep the layout
  coherent: stats rows first, then the collapsible cheat sheet. Neither should break the other.
- **Keyboard/a11y.** `<details>/<summary>` is focusable and toggles on Enter/Space by default — don't
  re-implement it with a div+click that loses that. The outside-click/Escape handling of the popover
  must still work with the details expanded.
- **No dead interactivity.** Don't add copy/insert buttons here (out of scope); keep it read-only.

## Relevant tests

This is static UI with no pure logic, so it's verified by **manual E2E** per `CLAUDE.md` (Svelte
components are covered by manual E2E, not unit tests). No new Vitest spec is required; keep the existing
suite green.

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked):**
1. Open the ⓘ info popover → a collapsed "Markdown cheat sheet" section appears below the note info.
2. Expand it → the syntax reference shows, with examples displayed as literal text (not rendered).
3. If the list is tall, it scrolls within the popover and never runs off the bottom of the panel.
4. Toggle with the keyboard (Tab to the summary, Enter/Space) → expands/collapses; Escape/outside-click
   still closes the whole popover.
5. Looks correct in light and dark.
