# Note stats (word + line count)

> Roadmap item (Deferred): "Note stats: word count + reading-time estimate in the info popover."
> Narrowed during specification to **word count + line count** (reading time and task-progress were
> offered and declined). Its own small PR.

## Why?

The note info popover (`UtilityBar.svelte`, the ⓘ button) already surfaces at-a-glance facts about the
current note — Last edited, Characters, Notes used, Version. Word count and line count are the two most
commonly wanted "how big is this note" numbers and cost almost nothing to add, giving writers a quick
sense of length beyond the raw character counter.

## What?

When done, the info popover shows two new rows for the **current note body**:

- **Words** — the word count.
- **Lines** — the line count.

Both update live as the note changes (the popover already receives `body` reactively). Empty note →
`0` words and `0` (or `1`) lines per the defined rule below.

**In scope:** a pure stats module (`wordCount`, `lineCount`) with unit tests; two rows in the info
popover `<dl>`; docs.

**Out of scope:** reading-time estimate; task-progress; character count (already shown as
`used/limit`); putting stats anywhere other than the info popover; per-selection stats.

## Decisions

Locked during specification. Do not relitigate:

- **Word count + line count only.** Rationale: user's choice; reading time and task-progress were
  explicitly declined.
- **Pure functions in a new `src/lib/notes/stats.ts`, unit-tested.** Rationale: repo seam convention —
  pure logic in `lib/` with Vitest; the component just displays the numbers.
- **Word = run of non-whitespace separated by whitespace** (`body.trim().split(/\s+/)`), empty string →
  `0`. **Lines = number of `\n`-separated segments** (`body.split("\n").length`), with empty body → `0`
  (treat truly empty as zero rather than one). Rationale: simple, predictable, locale-agnostic; define
  the empty-note edge explicitly so tests are deterministic.
- **Displayed in the existing info popover**, reusing its `<dl>` rows. Rationale: it's the note-facts
  surface already; no new UI surface.

## How?

### 1. `src/lib/notes/stats.ts` (new, pure)

```ts
/** Number of whitespace-separated words in the text (empty/blank → 0). */
export function wordCount(text: string): number;

/** Number of lines in the text (empty → 0; otherwise \n-separated segments). */
export function lineCount(text: string): number;
```

- `wordCount`: `const t = text.trim(); return t ? t.split(/\s+/).length : 0;`
- `lineCount`: `return text.length === 0 ? 0 : text.split("\n").length;`

### 2. `src/components/UtilityBar.svelte`

- Import the two functions; derive `const words = $derived(wordCount(body))` and
  `const lines = $derived(lineCount(body))`.
- Add two `<dt>/<dd>` rows in the existing popover `<dl>` (e.g. after "Characters"): **Words** and
  **Lines**, using the same tabular-number styling already applied to `dd`.

### 3. Docs

- `docs/architecture.md`: add `src/lib/notes/stats.ts` to the map.
- `docs/overview.md`: (optional) note that the info popover shows word/line counts.
- `docs/roadmap/index.md`: remove this item from Deferred.

## Caveats

- **Define the empty-note case in tests**, or word/line counts drift between "0" and "1" ambiguously.
  The rules above: empty → 0 words, 0 lines.
- **Whitespace-only body** should be 0 words (the `trim()` guard handles it) — cover it.
- **Multi-byte / CJK text**: this is a whitespace-word count (not grapheme/segmentation-aware); that's
  acceptable and intentional for a lightweight stat — don't pull in `Intl.Segmenter` here.
- **No new reactivity plumbing needed** — `UtilityBar` already takes `body` as a reactive prop; just
  derive from it. Don't recompute on a timer.

## Relevant tests

Pure logic is unit-tested; the popover display is verified by manual E2E.

**New `tests/notes/stats.spec.ts`:**
- `wordCount`: `""`→0; `"   "`→0; `"hello"`→1; `"hello world"`→2; leading/trailing/multiple spaces and
  newlines collapse (`"  a\n b  c "`→3).
- `lineCount`: `""`→0; `"a"`→1; `"a\nb"`→2; `"a\n"`→2 (trailing newline yields an empty final segment);
  a multi-line note counts correctly.

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked):**
1. Open the ⓘ info popover on a note → Words and Lines rows appear with correct values.
2. Type more text / add lines → the numbers update live.
3. Clear the note → Words 0, Lines 0; both render correctly in light and dark.
