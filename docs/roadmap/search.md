# Search (cross-note)

> Phase 1 of 2. This task delivers the search **panel** and the ability to find a note by its
> content and open it. Jumping to and highlighting the exact match is a separate follow-up task,
> [highlighter.md](./highlighter.md), which depends on this one being merged first.

## Why?

The extension holds up to 10 Markdown notes (`MAX_NOTES` in `src/lib/storage/limits.ts`), each up
to 7500 characters. Today the only way to find something is to open notes one by one from the
dropdown selector and read them — the note **index** (`notes:index`) stores just titles, never
bodies, so nothing surfaces content. As users accumulate notes this becomes the top friction point:
"which note did I write that in?" Search answers that question directly. It is the next roadmap item
(`docs/roadmap/index.md`).

The dataset is tiny (≤10 notes × ≤7500 chars), so search can be exhaustive and in-memory — no index,
no ranking algorithm, no storage writes. The engineering challenge is UX and wiring, not scale.

## What?

When done, the side panel has a **search mode**:

- An **icon-only search button** (🔍) sits in the note's action button group in
  `src/components/NoteSelector.svelte` (the `.group` element that already holds the title trigger,
  the ✎ rename button, and the 🗑 delete button). It toggles search mode.
- A keyboard shortcut — **Cmd + `/`** on macOS / **Ctrl + `/`** on Windows/Linux — toggles search
  mode, but **only while focus is inside our side panel** (see How). Pressing it again closes search.
- Entering search mode **replaces the middle editor/view area** with: a text input at the top and a
  results list below. The top note selector + View/Edit tabs and the bottom status/tools bar stay
  put (they frame the panel; only the middle content swaps).
- Typing filters across **all notes' bodies**, case-insensitive plain-substring, updated live with a
  **200 ms debounce**. Queries shorter than **2 characters** produce no results (show a hint).
- Results are **grouped by note title**. Under each note title, there is **one row per match
  occurrence**, each showing a **single-line snippet** of context around the match with the matched
  substring emphasized. At most **20 occurrence rows per note**; if a note has more, the group ends
  with a muted line: `showing first 20/<total> in this note`.
- **Clicking a result row** exits search mode and opens that note, honoring the user's view-on-switch
  preference (`resolveViewMode`). In this task it stops there — it does **not** scroll to or
  highlight the match (that is [highlighter.md](./highlighter.md)).
- **Exiting search mode:** the search toggle button, the Cmd/Ctrl+`/` shortcut, and clicking a
  result all leave search mode and restore the editor/view.

**In scope:** the search button + shortcut, the search-mode panel (input + grouped results +
snippets), the pure search module and its tests, opening the clicked note.

**Out of scope (this task):** scrolling to / highlighting the matched text after opening — done in
[highlighter.md](./highlighter.md). Title matching, regex/fuzzy matching, ranking, search history,
and any change to stored data shape are all out of scope.

## Decisions

Locked during specification. Do not relitigate:

- **Body-only matching, case-insensitive plain substring.** Titles are used only as group labels, not
  matched. Rationale: the ask is "find the relevant information *in* notes"; title search adds little
  for 10 notes and complicates grouping. No regex/fuzzy — overkill at this scale.
- **Search-mode panel replaces the editor area**, rather than a dropdown filter or an overlay.
  Rationale: gives room for grouped results and snippets; the panel should show a search bar on top
  and results below.
- **Search button lives in the `NoteSelector` `.group`** next to rename/delete, icon-only.
  Rationale: it is a note-level action and that group is the established home for note actions.
- **One row per occurrence, capped at 20/note** with a `showing first 20/<total> in this note`
  footer when exceeded. Rationale: per-occurrence rows set up per-occurrence jump in phase 2 and act
  as in-note match navigation; the cap bounds the DOM for pathological notes.
- **Live search, 200 ms debounce, min 2 chars.** Rationale: searching ≤10 in-memory notes is
  instant, so live feels best; the debounce and min-length trim wasted recomputes and noise.
- **Cmd/Ctrl+`/` implemented as a `keydown` listener in the panel document** (not a `chrome.commands`
  entry). Rationale: the requirement is "only when focus is in our sidebar." The side panel is its
  own document, so a `window` keydown listener there **only** fires when the panel is focused —
  exactly the desired scope — whereas a global `chrome.commands` shortcut would fire regardless of
  focus and needs a manifest slot. The shortcut **toggles** (open if closed, close if open).
- **Clicking a result opens the note via `resolveViewMode`** (the existing view-on-switch preference)
  — same rule as switching notes from the dropdown, for consistency.
- **The pure search module returns match offsets now**, even though this task doesn't use them for
  highlighting. Rationale: [highlighter.md](./highlighter.md) consumes exact `{start, end}` body
  offsets; designing the data model once here avoids reworking the module in phase 2.
- **Search reads a fresh snapshot of all note bodies on entering search mode**, after flushing any
  pending autosave. Rationale: results must reflect the latest text, including unsaved edits to the
  current note.

## How?

Follow the repo seams (`docs/architecture.md`): pure logic in `src/lib/`, unit-tested under `tests/`;
persistence only through the repository; components stay thin.

### 1. Pure search module — `src/lib/search/search.ts` (new)

Export the search function and its result types. Suggested shape (adjust names sensibly, keep the
offsets):

```ts
import type { Note } from "../storage/NotesRepository";

export const MIN_QUERY_LENGTH = 2;
export const MAX_OCCURRENCES_PER_NOTE = 20;
export const SNIPPET_CONTEXT_CHARS = 40; // chars of context each side of the match

export interface NoteMatch {
  start: number;      // offset in note.body where the match begins
  end: number;        // start + query.length
  snippet: string;    // single-line context window (newlines/space collapsed)
  matchStart: number; // offset of the match *within* snippet (for emphasis)
  matchEnd: number;
}

export interface NoteSearchResult {
  id: string;
  title: string;
  matches: NoteMatch[]; // capped to MAX_OCCURRENCES_PER_NOTE
  totalMatches: number; // full count before the cap
}

/** Case-insensitive, body-only substring search. Returns only notes with ≥1 match,
 *  in the order `notes` was given; occurrences within a note in ascending `start`. */
export function searchNotes(query: string, notes: Note[]): NoteSearchResult[];
```

Details:
- Trim the query; if its length `< MIN_QUERY_LENGTH`, return `[]`.
- Lowercase both sides for matching; find **all non-overlapping** occurrences (advance the scan index
  by the match length, or at least by 1, to avoid infinite loops on empty edge cases).
- Build each `snippet` from the raw body: take up to `SNIPPET_CONTEXT_CHARS` before `start` and after
  `end`, collapse runs of whitespace/newlines to single spaces, add a leading/trailing `…` when
  truncated, and compute `matchStart`/`matchEnd` relative to the produced snippet string.
- Cap `matches` at `MAX_OCCURRENCES_PER_NOTE` but set `totalMatches` to the true count.

### 2. Search panel component — `src/components/SearchPanel.svelte` (new)

Props: the full notes array (`Note[]`), an `onOpen(noteId, match)` callback, and an `onClose`
callback. Responsibilities:
- Autofocused text input; keep local query state; debounce recompute by **200 ms** (reuse
  `src/lib/util/debounce.ts` — see `debounce(...).cancel()`/`flush()` usage in `App.svelte`).
- Render `searchNotes(query, notes)` grouped by note: a title header, then occurrence rows. Emphasize
  the matched substring inside each snippet using `matchStart`/`matchEnd` (plain-text slicing +
  a `<strong>`/`<mark>` span — **never** `{@html}`; snippet text is untrusted note content).
- When a note exceeds the cap, render the `showing first 20/<total> in this note` footer line.
- States: query `< 2` chars → hint ("Type at least 2 characters"); ≥2 chars and no results →
  "No matches". Clicking a row calls `onOpen(note.id, match)`.
- Escape inside the input calls `onClose` (mirror the outside-click/Escape pattern already in
  `NoteSelector.svelte` / `UtilityBar.svelte`).
- Match the existing panel styling: reuse the CSS variables (`--bg`, `--bg-subtle`, `--border`,
  `--text`, `--text-muted`, `--accent`) so it themes in light/dark automatically.

### 3. Wire into `NoteSelector.svelte`

Add a new icon-only button to the `.group` (alongside ✎ / 🗑) that calls a new `onSearch` prop.
Give it `title`/`aria-label` "Search notes". Optionally accept a `searchActive` prop to style it as
pressed while search mode is on. Thread the new prop through the component's `$props()` type.

### 4. Orchestrate in `src/sidepanel/App.svelte`

- Add `let searching = $state(false);` and `let searchNotesData = $state<Note[]>([]);`.
- `openSearch()`: `await commitPending();` (flush pending autosave so the snapshot is current), then
  gather every full note — reuse the **exact pattern already in `exportBackup`**:
  `const metas = await repo.list(); const full = (await Promise.all(metas.map(m => repo.get(m.id)))).filter((n): n is Note => n !== null);` — set `searchNotesData = full; searching = true;`.
- `closeSearch()`: `searching = false`.
- `toggleSearch()`: `searching ? closeSearch() : openSearch()`.
- Pass `onSearch={toggleSearch}` (and `searchActive={searching}`) to `<NoteSelector>`.
- In the `<main class="content">` block, render `<SearchPanel>` when `searching`, otherwise the
  existing `{#if mode === 'edit'} … {:else} … {/if}`.
- `onOpen(noteId, _match)`: `closeSearch()`, then `await selectNote(noteId)` (which already calls
  `commitPending`, `loadNote`, and sets `mode = resolveViewMode(...)`). Ignore `_match` in this task;
  its presence is the seam [highlighter.md](./highlighter.md) builds on.
- **Keyboard shortcut:** in the existing `onMount`/`$effect` area, add a `window` `keydown` listener:
  `if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); toggleSearch(); }`.
  Register/cleanup it the same way the visibility/pagehide listeners are managed in `App.svelte`.
  Because this listener lives in the panel document, it only fires when the panel has focus — which
  is precisely the "only if focus is in our sidebar" requirement.

### 5. Docs

Update `docs/overview.md` ("What it does today") to mention search, and tick/annotate the Search item
in `docs/roadmap/index.md`. Add a one-line entry to `docs/architecture.md`'s file map for
`src/lib/search/search.ts` and `SearchPanel.svelte`.

## Caveats

- **Do not render snippet text as HTML.** Note bodies are untrusted (that's why `render.ts` exists).
  In the results list, build the emphasis by slicing the snippet string and putting the matched span
  in its own element — never `{@html}`. This panel shows *raw* note text, not rendered Markdown.
- **No storage writes.** Search is read-only. Do not `save`/`rename`/touch the repository beyond
  `list()`/`get()`. Respect the "persistence only via the repository" seam — don't reach into
  `chrome.storage` directly.
- **Flush before snapshotting.** If you skip `commitPending()` before gathering bodies, a note edited
  within the last 3 s (the autosave debounce) will be searched with stale text. `exportBackup`
  already documents this exact concern.
- **Empty/first-run states.** With one empty note (the `firstOrCreate` default), search over an empty
  body must simply yield no matches — not error. Guard against an empty query and empty bodies.
- **Occurrence scan safety.** When advancing the match scan, always move the index forward by at
  least one to avoid an infinite loop.
- **Shortcut key detail.** Match on `e.key === '/'`. `e.metaKey || e.ctrlKey` covers both platforms;
  firing on Ctrl+`/` on macOS too is harmless. Call `preventDefault()` so the browser/textarea does
  nothing else with the chord.
- **Focus/selection.** Autofocus the search input on open; ensure the outside-click handling doesn't
  fight the note dropdown (they are separate surfaces; search mode replaces the editor, the dropdown
  is in the top bar and can stay usable).
- **This task must merge before [highlighter.md](./highlighter.md).** Keep the `onOpen(noteId, match)`
  signature intact — phase 2 depends on receiving the clicked `NoteMatch`.

## Relevant tests

Follow the repo convention: one Vitest spec per meaningful pure function, mirroring `src/` under
`tests/`. Components are verified by manual load-unpacked E2E (see `CLAUDE.md`).

**New unit tests — `tests/search/search.spec.ts`:**
- Query below `MIN_QUERY_LENGTH` → `[]`.
- Single match: correct `start`/`end`, snippet contains the match, `matchStart`/`matchEnd` index the
  match within the snippet.
- Case-insensitivity: `"todo"` matches `"TODO"` and `"ToDo"`.
- Multiple occurrences in one note → multiple rows, ascending `start`, correct `totalMatches`.
- More than `MAX_OCCURRENCES_PER_NOTE` occurrences → `matches.length === 20` but
  `totalMatches === <real count>`.
- Snippet truncation: long body → snippet is bounded, whitespace/newlines collapsed, `…` added when
  truncated; short body → no ellipsis, no out-of-range offsets.
- Result ordering: notes returned in input order; only notes with ≥1 match appear; a note with no
  match is absent.
- No match anywhere → `[]`; empty-body notes don't error.

**Commands (all must be green):**
```
npm test          # Vitest — new search specs + existing suite
npm run check     # svelte-check — types/Svelte diagnostics (covers new component props)
npm run lint      # Biome
npm run build     # production build into dist/
```

**Manual E2E (load `dist/` unpacked, per `CLAUDE.md` → "Load the extension"):**
These are done by user, show them the list
1. Click the 🔍 button in the note action group → editor is replaced by the search input + results;
   input is focused.
2. Type ≥2 chars present in several notes → results appear grouped by note title, one row per
   occurrence, matched substring emphasized, updating ~200 ms after you stop typing.
3. Type <2 chars → hint shown, no results. Type something absent → "No matches".
4. A note with >20 occurrences shows exactly 20 rows plus `showing first 20/<total> in this note`.
5. Click a result → search closes, that note opens (in the mode your view-on-switch preference
   dictates). (No scroll/highlight yet — expected.)
6. Press Cmd+`/` (mac) / Ctrl+`/` (win) with the panel focused → toggles search open, then closed.
   With focus in another tab/page, the chord does nothing to our panel.
7. Edit the current note, then within 3 s open search and query the just-typed text → it is found
   (flush-before-snapshot works).
8. Confirm light and dark themes both look right.
