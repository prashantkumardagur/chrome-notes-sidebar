# Regex search

> Builds directly on the shipped cross-note search ([search.md](./search.md)) and its jump-to-match
> follow-up ([highlighter.md](./highlighter.md)). Read both first — this task **changes the matching
> engine** inside the existing search flow; it does not add a new surface.

## Why?

Cross-note search today (`src/lib/search/search.ts`) is a **case-insensitive plain-substring** scan
over note bodies. That answers "which note did I write X in?" for literal text, but power users keep
notes full of structured content — TODO markers, dates, URLs, code — where the useful query is a
*pattern*, not a literal: "every `TODO(...)`", "any `\d{4}-\d{2}-\d{2}` date", "lines starting with
`- [ ]`". Regex is the deferred roadmap item (`docs/roadmap/index.md` → Deferred) that unlocks this.

The dataset is still tiny (≤10 notes × ≤7500 chars — `MAX_NOTES` / `MAX_NOTE_CHARS` in
`src/lib/storage/limits.ts`), so matching stays exhaustive and in-memory. The work is swapping the
substring scan for a compiled `RegExp`, surfacing invalid-pattern feedback, adding a
case-sensitivity control, and bounding a runaway scan — **without** disturbing the result-grouping,
snippet, session-restore, or jump-to-match machinery that already exists.

## What?

When done, the existing search mode (the 🔍 panel that replaces the editor area) interprets the query
as a **regular expression**, always:

- **Every query is a JS regex.** A plain query like `todo` still works (literal text is a valid
  regex), while `foo.*bar`, `\bTODO\b`, `[aeiou]`, or `\d{4}` now match as patterns. There is **no
  substring/regex toggle** — regex is the one and only mode.
- **Case-insensitive by default, with an `Aa` toggle.** A new case-sensitivity toggle button sits in
  the search bar next to the ✕ close button. Off (default) = the `i` flag is applied, matching
  today's behaviour; on = case-sensitive matching. The toggle state persists across leaving/re-
  entering search and across panel close/reopen (same session store as `query`/`collapsed`).
- **Invalid patterns show an inline error, not results.** While the query is a syntactically invalid
  regex (e.g. an unbalanced `(`, a lone `[`, a trailing `\`), the results area shows a muted error
  line (e.g. `Invalid regular expression`) instead of "No matches" — so the user understands *why*
  nothing matched. A too-short query (< `MIN_QUERY_LENGTH`) keeps today's "Type at least 2
  characters" hint (checked before compiling).
- **Results, grouping, snippets, caps, and click-to-open are unchanged.** Still grouped by note
  title, one row per occurrence, single-line emphasized snippet, `MAX_OCCURRENCES_PER_NOTE = 20`
  rows per note with a `showing first 20/<total> in this note` footer, click a row to open the note
  and jump to the match. Match snippets and highlighting work for variable-length matches because
  they are already offset-based.
- **A runaway scan is bounded.** A per-note hard iteration ceiling stops a degenerate many-match or
  zero-width pattern from spinning forever (see Decisions / Caveats for what this does and does not
  protect against).

**In scope:** regex compilation + flags in the pure search module, the case toggle UI + its session
persistence, the invalid-regex error state, the iteration ceiling, and tests for all of it.

**Out of scope:** any change to `src/lib/search/highlight.ts` (it already works — see How),
multiline/dotall flag controls (`m`/`s`), a regex *builder*/cheatsheet UI, saved/named searches,
replace-in-notes, title matching, or any change to the **stored note shape** or the sync/settings
repositories. Only the *session* search-state shape gains one field.

## Decisions

Locked during specification. Do not relitigate:

- **Always-regex, no substring/regex toggle.** The query is always compiled as a `RegExp`. Rationale:
  a mode toggle adds UI and state for little gain; literal text is already a valid regex, so plain
  searches keep working. **Accepted tradeoff:** queries containing regex metacharacters change
  meaning — searching `[ ]` now matches a single space (character class), `(link)` matches `link`
  (group), `a.b` matches `axb`. This is inherent to always-regex and is accepted; it is documented,
  not worked around. A *syntactically invalid* metachar query surfaces the inline error instead.
- **Case-insensitive default + an `Aa` toggle** (rejected: case-sensitive default; keeping today's
  forced-insensitive with no control). Rationale: preserves the current feel for the common case
  while giving regex users case control. The toggle applies/removes the `i` flag.
- **Flags are `g` (always) + `i` (unless case-sensitive). No `m`, no `s`.** Rationale: `g` is
  required to iterate occurrences via `lastIndex`; `^`/`$` matching whole-body start/end (not per
  line) and `.` not crossing newlines keep results predictable and match the existing line-clamped
  snippet model. Multiline/dotall controls are deferred.
- **`MIN_QUERY_LENGTH` stays 2** (checked on the raw, trimmed query *before* compiling). Rationale:
  avoids single-char patterns like `.` matching every character in every note (flooded results and
  snippets); a 1-char search is rarely useful. Same "type at least 2 characters" hint as today.
- **Invalid regex → inline error state**, distinct from "No matches". Rationale: an unbalanced `(`
  otherwise silently reads as "nothing found", which is confusing. The error is shown only for a
  query that is ≥ `MIN_QUERY_LENGTH` but fails to compile.
- **Runaway guard = a per-note hard iteration ceiling** that caps how many match iterations the scan
  performs per note; keep `MAX_OCCURRENCES_PER_NOTE = 20` for *displayed* rows exactly as today.
  Rationale: cheaply bounds degenerate many-match and zero-width patterns. **Explicitly NOT solved by
  this:** catastrophic backtracking *inside a single `exec()`* (e.g. `(a+)+$` on a long non-matching
  run) — that hangs before any iteration completes, so an iteration cap cannot fire. That residual
  risk is **accepted** because this is a single-user local tool: a pathological pattern only freezes
  the author's own panel until they edit the query. (Rejected: a Web Worker + kill-timer — the only
  real fix for backtracking — as disproportionate at this scale.)
- **Zero-length matches are skipped, not emitted.** Patterns that can match the empty string (`a*`,
  `\b`, `^`, `x?`) produce zero-width matches; these are not counted or shown (an empty highlight is
  meaningless), and the scan advances `lastIndex` by 1 past them to avoid an infinite loop.
- **`highlight.ts` is not touched.** Rationale (verified): `App.svelte` arms jump-to-match with the
  **matched literal text**, `body.slice(match.start, match.end)` (`src/sidepanel/App.svelte` ~line
  169), *not* the raw query. So `selectRangeInTextarea` (offset-based) and `highlightMatchesInView`
  (plain `indexOf` of that literal) both keep working for regex matches with no change.

## How?

Follow the repo seams (`docs/architecture.md`): pure logic in `src/lib/`, unit-tested under `tests/`;
persistence only through a repository; components stay thin. All the pieces below already exist — this
task modifies them.

### 1. Pure search module — `src/lib/search/search.ts` (modify)

Replace the substring scan with a compiled-`RegExp` scan while keeping the `NoteMatch` /
`NoteSearchResult` shapes and `buildSnippet` **unchanged** (they are offset-based and already handle
variable-length spans). Suggested shape (adjust names sensibly; keep the offsets and the existing
constants):

```ts
export const MIN_QUERY_LENGTH = 2;              // unchanged
export const MAX_OCCURRENCES_PER_NOTE = 20;     // unchanged — displayed rows
export const SNIPPET_CONTEXT_CHARS = 40;        // unchanged
/** Hard ceiling on match iterations per note — the runaway guard. Generous; never
 *  hit in normal use, only stops degenerate many-match / zero-width loops. */
export const MAX_MATCH_ITERATIONS_PER_NOTE = 100_000;

export interface SearchOptions {
  caseSensitive?: boolean; // default false → the `i` flag is applied
}

/** Distinguishes the three empty-result reasons the UI must render differently. */
export type SearchError = "too-short" | "invalid-regex";

/** Compile the query into a scanning RegExp, or report why it can't run.
 *  Trims + length-checks BEFORE constructing the RegExp. */
export function compileQuery(
  query: string,
  options?: SearchOptions,
): { ok: true; regex: RegExp } | { ok: false; error: SearchError };

/** Regex-based, body-only search. Returns only notes with ≥1 match, in input
 *  order; occurrences ascend by `start`; `matches` capped to
 *  MAX_OCCURRENCES_PER_NOTE, `totalMatches` is the true (bounded) count. */
export function searchNotes(
  query: string,
  notes: Note[],
  options?: SearchOptions,
): { results: NoteSearchResult[]; error: SearchError | null };
```

Details:
- **`compileQuery`:** trim the query; if `< MIN_QUERY_LENGTH` → `{ ok: false, error: "too-short" }`.
  Otherwise build `new RegExp(query, flags)` in a `try/catch`; on `SyntaxError` →
  `{ ok: false, error: "invalid-regex" }`. Flags: `"g"` plus `"i"` unless `options.caseSensitive`.
- **`searchNotes`:** call `compileQuery`; on `{ ok: false }` return `{ results: [], error }`. On
  success, for each note run the `g` regex over `note.body` via `regex.exec` in a loop:
  - Clone/reset per note (a `g` RegExp carries `lastIndex`); simplest is to build one regex per note
    or reset `lastIndex = 0` before each note.
  - For each match `m`: `start = m.index`, `end = m.index + m[0].length`. **Skip zero-length
    matches** (`m[0].length === 0`): don't count, advance `regex.lastIndex++`, continue.
  - Otherwise increment `totalMatches`; if `matches.length < MAX_OCCURRENCES_PER_NOTE`, push
    `{ start, end, ...buildSnippet(note.body, start, end) }` (reuse the existing helper untouched).
  - **Iteration ceiling:** count loop iterations; if they reach `MAX_MATCH_ITERATIONS_PER_NOTE`,
    stop scanning that note (its `totalMatches` is then a lower bound — acceptable; the footer
    already reads `showing first 20/<total>`).
  - Return only notes with `totalMatches > 0`, in input order, with `error: null`.

Keep the module comment honest: note it is now regex-based and that the ceiling bounds iterations but
**not** single-`exec` backtracking.

### 2. Search state — `src/lib/search/searchState.ts` (modify)

Add one field to `SearchState` and its normalizer:

```ts
export interface SearchState {
  active: boolean;
  query: string;
  collapsed: string[];
  caseSensitive: boolean; // NEW — regex case toggle; default false
}
```

- Add `caseSensitive: false` to `EMPTY_SEARCH_STATE`.
- In `normalizeSearchState`, coerce: `caseSensitive: raw.caseSensitive === true`. This is
  **session**-scoped state (`SessionSearchStateRepository`, `chrome.storage.session`) — no sync
  migration, and the normalizer already tolerates old/partial records (a stored object without the
  field simply defaults to `false`).

### 3. Search panel component — `src/components/SearchPanel.svelte` (modify)

- Add a bindable `caseSensitive` prop (`$bindable(false)`), threaded like `query`/`collapsed`, so
  App owns the persisted value.
- Add an **`Aa` toggle button** in the `.bar`, before the ✕ close button. Style it like `.close`
  (transparent, `--text-muted`, hover fill); reflect state with `aria-pressed={caseSensitive}` and a
  pressed style (e.g. `--accent` colour). `title`/`aria-label`: "Match case".
- Recompute using the new return shape:
  ```ts
  const { results, error } = $derived(searchNotes(applied, notes, { caseSensitive }));
  ```
  Recompute must also react to `caseSensitive` changing — either fold it through the debounced
  `applied` path or recompute derived on `caseSensitive` directly (a toggle click can apply
  immediately; it need not wait the 200 ms debounce).
- Results-area states:
  - `error === "too-short"` → existing "Type at least {MIN_QUERY_LENGTH} characters to search." hint.
  - `error === "invalid-regex"` → new muted error line, e.g. "Invalid regular expression." (a `.hint`
    variant, e.g. `.hint.error`). **Plain text only — never `{@html}`.**
  - `error === null && results.length === 0` → existing "No matches." hint.
  - otherwise → the existing grouped results (unchanged markup, including the `<mark>` emphasis via
    `matchStart`/`matchEnd` — still plain-text slicing, never `{@html}`).
- Optionally update the placeholder to hint regex (e.g. "Search all notes (regex)…"). Keep the
  Escape-to-close behaviour and the `MIN_QUERY_LENGTH` import.

### 4. Orchestration — `src/sidepanel/App.svelte` (modify)

- Add `let searchCaseSensitive = $state(false);` alongside `searchQuery` / `searchCollapsed`.
- `bind:caseSensitive={searchCaseSensitive}` on `<SearchPanel>`.
- Include it in the persisted snapshot effect and the mount restore:
  - snapshot: `{ active: searching, query: searchQuery, collapsed: [...searchCollapsed], caseSensitive: searchCaseSensitive }`.
  - restore: `searchCaseSensitive = saved.caseSensitive;` next to `searchQuery = saved.query;`.
- **Do not change `openSearchResult` / the highlight arming.** It already derives the highlight from
  the matched body slice, so regex matches jump/highlight correctly with no edit.

### 5. Docs

- `docs/roadmap/index.md`: move **Regex search** out of Deferred (into Next Tasks while in flight,
  then Done on merge), linking this file; leave Password protection under Deferred.
- `docs/architecture.md`: update the `search/search.ts` one-liner from "case-insensitive body-only
  substring search" to reflect regex matching + case toggle; mention the new `caseSensitive` field in
  the `search:state` storage-layout entry.
- `docs/overview.md`: if it describes search, note that it is regex-capable.

## Caveats

- **Reset `lastIndex` per note.** A `g`-flagged `RegExp` is stateful; reusing one instance across
  notes without resetting `lastIndex` (or rebuilding per note) skips matches at the start of later
  notes. Build per note or set `regex.lastIndex = 0` before each.
- **Zero-length match infinite loop.** `regex.exec` with a pattern that can match empty (`a*`, `\b`,
  `^`, `x?`) returns a zero-width match without advancing `lastIndex` — you MUST bump `lastIndex`
  manually and skip it, or the loop never terminates. This is the #1 correctness trap; cover it in
  tests.
- **The iteration ceiling does not stop catastrophic backtracking.** It bounds the *number of
  matches/iterations*, but a pattern like `(a+)+$` or `(.*)*x` burns exponential time *inside one
  `exec()` call*, before returning a single match — the loop counter never advances, so the ceiling
  never fires and the panel thread freezes until the query is edited. This is an **accepted** risk
  (single-user, local, self-inflicted). Do not claim the guard prevents ReDoS; say what it actually
  does. The heavy fix (off-thread + timeout) is deliberately out of scope.
- **Always-regex changes literal-search semantics.** Users searching for markdown-ish literals
  (`[ ]`, `- [ ]`, `(url)`, `*bold*`, `$5.00`, `a.b`) will get regex behaviour, and an *invalid* one
  (`(` alone) surfaces the error instead of a literal find. This is by design (see Decisions) and
  must be documented, not silently "fixed" by escaping the query.
- **No `{@html}`.** The snippet emphasis and the new error line are untrusted/plain text — keep the
  slice-into-`<mark>` pattern; never inject HTML. This panel shows *raw* note text, not rendered
  Markdown.
- **No storage writes to notes/settings.** Search stays read-only over the note snapshot; the only
  new persistence is the `caseSensitive` field in the existing **session** search-state store. Do not
  touch `chrome.storage` outside the repositories, and do not change the synced note/settings shape.
- **Case-sensitive search vs. View-mode highlight.** `highlightMatchesInView` lowercases and matches
  case-insensitively, so with the case toggle *on*, opening a result in View mode may `<mark>` extra
  case variants of the matched literal. Minor and pre-existing to the highlight design; acceptable —
  do not rework `highlight.ts` for it.
- **Recompute on toggle.** Flipping `Aa` must re-run the search against the current query (it changes
  the `i` flag). Make sure the derived recomputation subscribes to `caseSensitive`, not only to the
  debounced query.
- **Keep `totalMatches` semantics for the footer.** The `showing first 20/<total> in this note` line
  relies on `totalMatches` being the full (now iteration-bounded) count while `matches` is capped at
  20 — preserve that split.

## Relevant tests

Follow the repo convention: one Vitest spec per meaningful pure function, mirroring `src/` under
`tests/`. Components are verified by manual load-unpacked E2E (see `CLAUDE.md`).

**Extend `tests/search/search.spec.ts`** (keep/adapt existing cases where behaviour is unchanged):

- **Compilation / errors:**
  - Query below `MIN_QUERY_LENGTH` → `error === "too-short"`, `results === []`.
  - Invalid regex (`"("`, `"["`, `"a\\"`) with length ≥ 2 → `error === "invalid-regex"`,
    `results === []`.
  - Valid pattern → `error === null`.
- **Matching:**
  - Case-insensitive by default: `"todo"` matches `"TODO"` and `"ToDo"`.
  - `caseSensitive: true`: `"TODO"` does **not** match `"todo"`; `"TODO"` matches `"TODO"`.
  - Metachar patterns: `"\\d+"` matches digit runs (variable length — check `start`/`end` and snippet
    cover the whole run); `"foo.*bar"` matches within a line; `"[aeiou]"` matches vowels.
  - Anchors are whole-body (default flags): `"^"`/`"$"` behave without the `m` flag (document via a
    test that a mid-body line start is not matched by `^`).
- **Offsets / snippets:** variable-length match → snippet contains the full match, `matchStart`/
  `matchEnd` index it within the snippet, line-clamping + `…` truncation still correct (reuse
  existing snippet assertions).
- **Occurrences / caps / order:** multiple matches → ascending `start`, correct `totalMatches`; more
  than `MAX_OCCURRENCES_PER_NOTE` → `matches.length === 20`, `totalMatches` = real count; notes in
  input order; only notes with ≥1 match present; empty-body notes don't error.
- **Zero-width safety:** a pattern that can match empty (`"a*"`, `"\\b"`) over a non-empty body
  **terminates** (no hang) and does not emit zero-length matches — assert the call returns and every
  emitted match has `end > start`.
- **Iteration ceiling:** a pattern producing a huge number of matches over a large synthetic body
  returns within bounds (does not hang); assert it completes and `matches.length ≤ 20`.

**Commands (all must be green):**
```
npm test          # Vitest — search specs + existing suite
npm run check     # svelte-check — types/Svelte diagnostics (new prop + return-shape changes)
npm run lint      # Biome
npm run build     # production build into dist/
```

**Manual E2E (load `dist/` unpacked, per `CLAUDE.md` → "Load the extension") — run by the user:**
1. Open search (🔍 or Cmd/Ctrl+`/`). Type a plain word present in several notes → same grouped
   results as before.
2. Type a regex, e.g. `\d{4}` or `foo.*bar` → pattern matches appear, grouped, emphasized; snippets
   cover the full (variable-length) match.
3. Type an invalid regex, e.g. `(` → inline "Invalid regular expression" shown (not "No matches").
   Fix it → results return.
4. Toggle `Aa` on, search `TODO` → only exact-case matches; toggle off → case-insensitive again.
   Results update on toggle without needing to retype.
5. Type `<2` chars → "Type at least 2 characters" hint (unchanged).
6. Click a result → note opens and jumps to / highlights the match in both Edit and View modes
   (highlighter still works for regex matches).
7. Close and reopen the panel → query **and** the `Aa` state are restored.
8. Confirm light and dark themes both look right, including the pressed `Aa` toggle and the error
   line.
