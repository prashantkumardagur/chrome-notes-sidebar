# Editor formatting toolbar

> Roadmap item (Deferred): "Editor formatting toolbar: bold/italic/heading/list/link/code buttons +
> shortcuts (Cmd+B/I/K) that wrap the textarea selection." Its own small PR.

## Why?

The Edit surface today is a bare `<textarea>` (`src/components/MarkdownEditor.svelte`). To emphasise a
word or add a link the user must type the Markdown syntax by hand and remember it. For a
quick-capture notes tool this is friction on the most common actions (bold, italic, link) and a
discoverability gap for anyone who doesn't know GFM. A small formatting toolbar plus the standard
`Cmd/Ctrl+B / I / K` shortcuts makes the everyday formatting one click (or keystroke) away, wrapping
the current selection with the right Markdown — the same affordance every Markdown editor offers.

## What?

When done, **Edit mode shows a thin toolbar row directly above the textarea** with six buttons —
**bold, italic, link, inline code, heading, bulleted list** — and the textarea responds to
**`Cmd/Ctrl+B` (bold), `Cmd/Ctrl+I` (italic), `Cmd/Ctrl+K` (link)**. Each action transforms the
current selection in place:

- **Inline wraps (bold `**`, italic `*`, code `` ` ``):** wrap the selected text in the markers; with
  no selection, insert the markers with the caret between them (empty) so the user can type. Applying
  the same action to already-wrapped text **unwraps** it (toggle).
- **Link (`[text](url)`):** wrap the selection as the link text with an empty `()` and place the caret
  inside the parentheses; with no selection, insert `[text](url)` with the word `text` selected.
- **Line-prefix actions (heading `# `, list `- `):** add the prefix to the start of each line the
  selection touches; if every touched line already has the prefix, remove it (toggle).

After any action the textarea **keeps focus** and the selection/caret is placed sensibly (selection
preserved around wrapped text; caret positioned for links/empty wraps), and the change **flows through
the existing autosave** exactly like typing.

**In scope:** a pure formatting module + its unit tests; a toolbar rendered inside the Edit surface;
the three keyboard shortcuts scoped to the editor; wiring the applied change back into `body` so
autosave and the char counter update; the char-budget guard (below); docs updates (architecture
layout contract, overview).

**Out of scope:** a rich-text/WYSIWYG editor (this stays a Markdown textarea — buttons only insert
Markdown syntax); the extended actions (quote, strikethrough, task-list) — a possible later PR;
per-button tooltips beyond `title`/`aria-label`; a toolbar in View mode; making the toolbar
configurable/reorderable; auto-continuing lists on Enter (separate concern).

## Decisions

Locked during specification. Do not relitigate:

- **Thin toolbar row inside the Edit surface, above the textarea** (not in the topbar, not
  shortcuts-only). Rationale: most discoverable without crowding the topbar; keeps the toolbar visible
  only where it applies (Edit). This extends the "Middle = textarea/rendered GFM" layout contract in
  `docs/architecture.md`, which must be updated to record the toolbar row.
- **The toolbar lives inside `MarkdownEditor.svelte`**, which owns the `<textarea>` ref. Rationale: the
  actions need the live `selectionStart`/`selectionEnd` and must re-focus the textarea; keeping toolbar
  and textarea in one component avoids threading the element ref up to `App.svelte`.
- **All text transformation is a pure function in a new `src/lib/markdown/format.ts`**, unit-tested;
  the Svelte component only reads the selection, calls the function, and writes back. Rationale: mirrors
  the repo seam convention (pure logic in `lib/` with Vitest specs; components verified by manual E2E).
- **Core six actions only** (bold, italic, link, inline code, heading, bulleted list). Rationale: keeps
  the PR small; the renderer already supports more GFM, so extended actions can follow later.
- **Shortcuts are `Cmd/Ctrl+B / I / K`, listener scoped to the textarea** (not `window`). Rationale:
  standard muscle-memory bindings; scoping to the editor avoids clashing with the global `Cmd/Ctrl+/`
  search toggle registered on `window` in `src/sidepanel/App.svelte`.
- **Inline and line-prefix actions toggle** (re-applying removes the markers). Rationale: expected
  editor behaviour; avoids `****bold****` pile-ups.
- **An action that would push the body over `MAX_NOTE_CHARS` is a no-op.** Rationale: the textarea
  already enforces `maxlength={MAX_NOTE_CHARS}` for typing, but programmatic writes via the `bind:value`
  binding bypass `maxlength`; the toolbar must not be a backdoor around the cap. Silently doing nothing
  (rather than a truncated/partial insert) matches how typing at the cap simply stops accepting input.

## How?

### 1. `src/lib/markdown/format.ts` (new, pure)

Export a single entry point plus an action type:

```ts
export type FormatAction = 'bold' | 'italic' | 'code' | 'link' | 'heading' | 'list';

export interface FormatResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Apply a formatting action to `text` given the current selection. Pure. */
export function applyFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  action: FormatAction,
): FormatResult;
```

- Model the wraps with a small table (`bold → '**'`, `italic → '*'`, `code → '` `'`).
- **Inline wrap:** if the chars immediately surrounding the selection already equal the marker,
  remove them (toggle) and shift the selection; else insert markers around the selection. Empty
  selection → insert `marker+marker`, caret between.
- **Link:** empty selection → insert `[text](url)`-shaped string with `text` selected (return the range
  covering the placeholder); non-empty → `[<selection>]()` with caret inside `()`.
- **Line-prefix (heading/list):** find the line span covering `[selectionStart, selectionEnd]`, split
  into lines, and add the prefix to each; if all already have it, strip it. Recompute the selection to
  cover the modified line span. Use `# ` for heading and `- ` for list.
- Keep it dependency-free; no DOM access.

### 2. `src/components/MarkdownEditor.svelte`

- Add a toolbar `<div>` above the `<textarea>`, wrapping both in a flex column container so the
  textarea still fills the remaining height (the content area is `flex:1; min-height:0` — see
  `App.svelte` `.content`). The textarea keeps `height:100%` of the *remaining* space.
- Each button: `type="button"`, an `aria-label` + `title` (e.g. "Bold (Cmd/Ctrl+B)"), an inline SVG or
  text glyph, `onmousedown={(e) => e.preventDefault()}` so clicking doesn't blur the textarea, and
  `onclick={() => run(action)}`.
- `run(action)`: read `textarea.selectionStart/End`, call `applyFormat(value, ...)`, and **guard**:
  if `result.text.length > maxlength` (the `MAX_NOTE_CHARS` prop already passed in), return without
  changing anything. Otherwise set `value = result.text`, call `oninput?.()` (so autosave fires exactly
  as on typing), then restore focus and set `textarea.selectionStart/End` to the returned range (do the
  selection restore in a microtask/`tick()` after the value binding flushes, reusing the pattern in
  `selectRangeInTextarea` from `src/lib/search/highlight.ts`).
- Add an `onkeydown` on the textarea mapping `(e.metaKey||e.ctrlKey) && e.key` `b`/`i`/`k` →
  `e.preventDefault()` + `run('bold'|'italic'|'link')`. Scope it to the textarea element, not `window`.
- Preserve existing props/behaviour: `value` (`$bindable`), `oninput`, `maxlength`, and the `select`
  jump-to-match `$effect`.

### 3. Docs

- `docs/architecture.md` → **UI layout contract**: note the Edit surface now has a thin formatting
  toolbar above the textarea.
- `docs/overview.md` → "What it does today": mention the formatting toolbar + `Cmd/Ctrl+B/I/K`.
- `docs/roadmap/index.md` → remove this item from Deferred (it's now shipped).

## Caveats

- **Programmatic writes bypass `maxlength`.** The `<textarea maxlength>` only limits *typed* input; a
  toolbar insert via `bind:value` is not checked by the DOM. The `run()` guard against
  `MAX_NOTE_CHARS` is the only thing keeping the toolbar from creating an over-cap body — do not omit
  it. (Byte-budget overflow is still caught at save by `bodyFitsStorage`, but the char guard gives
  immediate, consistent behaviour.)
- **Selection restore must run after the binding flushes.** Setting `value` then immediately reading
  `selectionStart` races Svelte's DOM update; use `tick()`/microtask like the existing
  `selectRangeInTextarea` helper, or the caret lands wrong.
- **`onmousedown preventDefault` on buttons is required** — otherwise clicking a button blurs the
  textarea, `selectionStart/End` collapse, and the wrap targets the wrong (empty) range.
- **Don't register the shortcuts on `window`.** `App.svelte` already listens on `window` for
  `Cmd/Ctrl+/`; a second `window` listener risks double-handling and firing while other surfaces
  (search, dropdown) are open. Editor-scoped keydown only fires when the textarea has focus.
- **Toolbar height eats editor height.** Keep the toolbar thin and ensure the textarea still gets
  `min-height:0` in the flex column, or it can overflow the panel. Verify in a short panel.
- **Accessibility/themes:** buttons need `aria-label`s and visible focus rings, and must look right in
  both light and dark using existing `--` tokens (see `src/sidepanel/app.css`). No hard-coded colors.
- **Toggle correctness on partial selections** (e.g. selecting only part of a bolded word) is the
  classic edge case — define it by the marker-adjacency rule above and cover it with tests rather than
  hand-waving.

## Relevant tests

Pure formatting logic is unit-tested; the Svelte wiring is verified by manual E2E (per `CLAUDE.md`).

**New `tests/markdown/format.spec.ts`** — cover `applyFormat` for every action:
- Bold/italic/code wrap a non-empty selection; empty selection inserts paired markers with caret
  between; re-applying to already-wrapped text unwraps it; returned selection range is correct in each.
- Link: empty selection inserts `[text](url)` with `text` selected; non-empty wraps the selection as
  link text with caret inside `()`.
- Heading/list: single-line adds the prefix; multi-line selection prefixes every touched line;
  re-applying when all lines already have the prefix removes it; selection recomputed to cover the span.
- Idempotence/round-trip: apply then re-apply returns the original text and a sane selection.

**Commands (all must be green):**
```
npm test          # Vitest — new format spec + existing suite
npm run check     # svelte-check
npm run lint      # Biome
npm run build     # production build into dist/
```

**Manual E2E (load `dist/` unpacked, per `CLAUDE.md` → "Load the extension"):**
1. Select a word, click **Bold** (and press `Cmd/Ctrl+B`) → wrapped in `**`; click again → unwrapped.
   Repeat for italic (`Cmd/Ctrl+I`) and inline code.
2. Select a word, `Cmd/Ctrl+K` → becomes `[word]()` with caret in the parens; type a URL → renders as a
   link in View mode.
3. Select several lines, click **List** → each line gets `- `; click again → removed. Same for Heading.
4. With the caret at the very end of a note that is **at** the char limit, click any button → nothing
   happens (no over-cap body), and the char counter stays at the limit.
5. After any action the textarea keeps focus and the selection is where you'd expect; the save dot goes
   Saving → Saved (autosave fired).
6. Toolbar looks correct in light and dark; buttons are keyboard-focusable with a visible ring.
