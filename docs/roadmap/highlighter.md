# Search result highlighting (jump to match)

> Phase 2 of 2. **Depends on [search.md](./search.md) being merged first.** That task builds the
> cross-note search panel and hands a clicked `NoteMatch` to `App.svelte` via
> `onOpen(noteId, match)` but ignores the `match`. This task consumes that `match` to scroll to and
> highlight the exact occurrence in the opened note.

## Why?

After [search.md](./search.md), clicking a search result opens the right note but drops the user at
the top — they still have to eyeball where the matched text is. For a 7500-character note that is
real friction. The payoff of search is landing **on** the match. This task closes that loop: click a
result → the note opens → the match is scrolled into view and highlighted, in whichever mode
(Edit / View) the note opened in.

## What?

When done, clicking an occurrence row in the search panel opens the note (as today) **and**:

- If the note opens in **Edit** mode (a `<textarea>`): the exact matched characters are **selected**
  (`setSelectionRange` + focus), which natively scrolls the selection into view and shows it
  highlighted. This targets the **specific clicked occurrence** by its known body offset.
- If the note opens in **View** mode (rendered Markdown): **every** rendered occurrence of the query
  is highlighted (wrapped in a highlight `<mark>`), and the view **scrolls to the occurrence nearest**
  the clicked one.
- Which highlighter runs is decided by the mode the note actually opened in — i.e. the mode
  `resolveViewMode(settings.view, mode)` produced (the same call `selectNote` already makes).
- **Highlights dismiss on interaction:**
  - View mode: clicking anywhere in the rendered note removes the highlights.
  - Edit mode: clicking in the textarea or typing clears the selection (native) — and the pending
    highlight state is dropped so it isn't re-applied.
- Highlights also clear naturally when the user switches notes or toggles Edit/View (the content
  re-renders / the pending highlight is reset).

**In scope:** two highlighter functions (edit-selection and view-mark), wiring the clicked
`NoteMatch` from `App.svelte` into `MarkdownEditor.svelte` / `MarkdownView.svelte`, scroll-into-view,
dismissal behavior, and unit tests for the pure/DOM-testable parts.

**Out of scope:** next/prev match navigation buttons (per-occurrence rows in the search panel already
serve that), highlighting while *typing* in the editor, and any change to search matching semantics
or stored data.

## Decisions

Locked during specification. Do not relitigate:

- **Two separate highlighter functions, chosen by resolved mode.** Rationale: a `<textarea>` can only
  show a native selection (one range), whereas rendered HTML can carry many `<mark>`s — the two
  surfaces are fundamentally different, so one abstraction would be forced.
- **Edit mode = exact single occurrence via `setSelectionRange`.** Rationale: the body offset from
  the `NoteMatch` maps 1:1 to textarea character positions, so the exact clicked occurrence is
  selected precisely, and the browser scrolls + highlights it for free.
- **View mode = highlight ALL rendered occurrences + scroll to nearest.** Rationale: a raw-body
  character offset does **not** map reliably onto sanitized rendered HTML (Markdown syntax is
  stripped/transformed), so pinning the exact Nth rendered occurrence is fragile. Highlighting every
  rendered occurrence of the query string and scrolling to the one nearest the clicked index is
  robust and still shows the user the full match set.
- **Highlight dismissal:** view — click anywhere in the note clears marks; edit — clicking/typing in
  the textarea clears the selection and the pending-highlight state. Rationale: matches the user's
  stated behavior and keeps highlights from lingering after the user starts working.
- **View highlighting is done by DOM post-processing of text nodes, never by injecting HTML.**
  Rationale: note content is untrusted; wrapping matches must operate on the already-sanitized,
  already-rendered DOM (text nodes only), so it can't introduce markup/XSS. `render.ts` stays the
  sole HTML producer and stays untouched.

## How?

Builds directly on the seams from [search.md](./search.md). Keep pure/DOM-testable logic in
`src/lib/search/`, unit-tested under `tests/search/`; keep components thin.

### 1. Highlighter module — `src/lib/search/highlight.ts` (new)

```ts
/** Edit mode: select the exact match range in the textarea and scroll it into view. */
export function selectRangeInTextarea(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
): void;

/** View mode: wrap every case-insensitive occurrence of `query` in `container`'s text nodes with a
 *  highlight <mark>, then scroll to the occurrence nearest `nearestIndex`. Returns count highlighted. */
export function highlightMatchesInView(
  container: HTMLElement,
  query: string,
  nearestIndex: number,
): number;

/** Remove any highlight <mark>s previously added by highlightMatchesInView (merge text back). */
export function clearViewHighlights(container: HTMLElement): void;
```

Implementation notes:
- `selectRangeInTextarea`: `textarea.focus(); textarea.setSelectionRange(start, end);`. To make the
  scroll reliable across browsers you may briefly `blur()`+`focus()` or set `scrollTop`; keep it
  simple and rely on the native behavior first.
- `highlightMatchesInView`: walk text nodes with a `TreeWalker` (`NodeFilter.SHOW_TEXT`), skip nodes
  already inside a highlight `<mark>` (and ideally skip `<pre>`/`<code>` if you want to avoid
  code-block noise — optional). For each occurrence, split the text node and wrap the match in a
  `<mark class="search-hit">`. Track occurrences in document order; after wrapping, call
  `scrollIntoView({ block: "center" })` on the mark whose index is closest to `nearestIndex`
  (clamp to `[0, count-1]`). **Guard `scrollIntoView`** — it's a no-op/undefined in jsdom, so call it
  only when it's a function.
- `clearViewHighlights`: replace each `mark.search-hit` with its text content and normalize the
  parent so text nodes merge back.

### 2. `MarkdownEditor.svelte`

- Add an optional prop, e.g. `select?: { start: number; end: number } | null`.
- In an `$effect`, when `select` is non-null and the textarea is mounted, call
  `selectRangeInTextarea(textarea, select.start, select.end)` (get the element via `bind:this`).
- Clearing is native: the existing `oninput`, and a click in the textarea, drop the selection. Ensure
  App resets the pending `select` to `null` after applying (or on `oninput`) so it doesn't re-fire.

### 3. `MarkdownView.svelte`

- Add an optional prop, e.g. `highlight?: { query: string; nearestIndex: number } | null`.
- The rendered HTML is `{@html html}` where `html` is `$derived(renderMarkdown(source))`. In an
  `$effect` that runs **after** the html is in the DOM, if `highlight` is set, call
  `highlightMatchesInView(viewEl, highlight.query, highlight.nearestIndex)` (get `viewEl` via
  `bind:this` on the `.view` container). Because a `source`/`html` change reassigns `innerHTML`, marks
  are wiped automatically on note switch or edit — no manual clear needed there.
- Add an `onclick` on the `.view` container that calls `clearViewHighlights(viewEl)` and notifies App
  to reset the pending highlight (so it isn't re-applied by the effect).
- Add a `.search-hit` style (themed via existing CSS variables, legible in light + dark).

### 4. `App.svelte` wiring

- `search.md` already passes the clicked `NoteMatch` to `onOpen(noteId, match)`. Store it as pending
  highlight state, e.g. `let pendingMatch = $state<NoteMatch | null>(null);` and the clicked
  occurrence's index within its note's `matches` (for `nearestIndex`).
- After `selectNote(noteId)` resolves and `mode` is known:
  - if `mode === 'edit'`, pass `select={{ start: match.start, end: match.end }}` to `MarkdownEditor`.
  - if `mode === 'view'`, pass `highlight={{ query, nearestIndex }}` to `MarkdownView`.
- Reset the pending state to `null` on: the editor's `oninput`, the view's dismiss click, a note
  switch, and an Edit/View toggle — so a stale highlight never reappears.
- Keep the query string available to `onOpen` (the search panel has it) so View highlighting knows
  what to mark.

### 5. Docs

Add `src/lib/search/highlight.ts` to the `docs/architecture.md` file map, and note the
"search → jump to match" behavior in `docs/overview.md`. Tick the highlighter item in
`docs/roadmap/index.md`.

## Caveats

- **Offset→rendered mismatch is expected.** A raw-body offset can't be trusted against sanitized HTML;
  that's *why* View mode highlights all occurrences + scrolls to nearest instead of the exact Nth.
  Don't try to "fix" this by mapping offsets into the DOM.
- **Query substrings that span Markdown syntax may not highlight in View mode.** E.g. searching `*te`
  against `*text*` matches the raw body but the rendered text is `text` — no `*`, so nothing to mark.
  This is acceptable, documented degradation; Edit mode still selects it exactly.
- **Never inject HTML.** View highlighting mutates existing text nodes only. Do not build a new HTML
  string with `<mark>` and `{@html}` it — that would reintroduce the XSS surface `render.ts` guards.
  `render.ts` remains the only HTML producer.
- **`scrollIntoView` in jsdom.** It's not implemented in jsdom; guard the call so unit tests don't
  throw. Tests assert on the marks, not the scroll.
- **Re-entrancy / double-marking.** Guard `highlightMatchesInView` so re-running it doesn't wrap
  already-wrapped matches (skip nodes inside a `.search-hit`). Clearing then re-marking is fine.
- **Selection scroll flakiness.** `setSelectionRange` scroll behavior varies; if a match near the
  bottom of a long note doesn't scroll into view on some browsers, nudge `scrollTop`. Verify manually.
- **Don't regress phase 1.** Opening a note from search must still work when there's nothing to
  highlight (empty query can't reach here, but a note that opened without a pending match must render
  normally).

## Relevant tests

`tests/` runs under **jsdom** (`vitest.config.ts`), so DOM-walking logic is unit-testable; `scrollIntoView`
is not implemented there and must be guarded. Components are verified by manual E2E.

**New unit tests — `tests/search/highlight.spec.ts`:**
- `highlightMatchesInView`: build a container from `renderMarkdown(source)` (reuse the real renderer),
  run it, assert the expected number of `mark.search-hit` elements and that their text equals the
  query (case-insensitive). No throw when `scrollIntoView` is absent.
- Multiple occurrences across multiple text nodes/elements are each wrapped.
- Occurrences inside already-highlighted nodes are not double-wrapped on a second run.
- `clearViewHighlights` restores the container to its pre-highlight text (marks removed, text merged).
- `selectRangeInTextarea`: with a jsdom `<textarea>` whose `value` is set, assert
  `selectionStart`/`selectionEnd` equal the requested range after the call.
- Nearest-index selection: given N occurrences, the mark chosen for scroll corresponds to the clamped
  `nearestIndex` (assert via a spy on the chosen element's `scrollIntoView`, or by which element the
  function targets — expose enough to test without asserting real scrolling).

**Commands (all must be green):**
```
npm test          # Vitest — new highlight specs + existing suite
npm run check     # svelte-check — new component props
npm run lint      # Biome
npm run build     # production build into dist/
```

**Manual E2E (load `dist/` unpacked; requires [search.md](./search.md) merged):**
1. With view-on-switch set so notes open in **Edit**: search, click an occurrence → note opens, the
   exact matched text is selected and scrolled into view. Click elsewhere / type → selection clears.
2. With view-on-switch set so notes open in **View**: search, click an occurrence → note opens, all
   rendered occurrences are highlighted and it scrolls to the one nearest your click. Click anywhere
   in the note → highlights disappear.
3. A note with matches near the bottom scrolls the match into view in both modes.
4. Switch notes / toggle Edit↔View → no stale highlight lingers.
5. Search a string that only exists inside Markdown syntax (e.g. `*te` in `*text*`) → Edit selects it;
   View may not mark it (expected, documented).
6. Light and dark themes: the `.search-hit` mark is legible in both.
