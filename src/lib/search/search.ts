/**
 * Pure, in-memory cross-note search.
 *
 * The dataset is tiny (≤10 notes × ≤7500 chars), so this is an exhaustive scan
 * over note *bodies* — no index, no ranking, no storage. Titles are used only as
 * group labels, never matched.
 *
 * The query is always compiled as a JavaScript `RegExp` (case-insensitive by
 * default; `options.caseSensitive` drops the `i` flag). Plain text still works
 * because a literal is a valid regex; queries with regex metacharacters match as
 * patterns. Offsets (`start`/`end`) are returned so the follow-up highlighter can
 * jump to the exact match.
 *
 * Runaway guard: {@link MAX_MATCH_ITERATIONS_PER_NOTE} bounds a degenerate
 * many-match or zero-width pattern per note. It does NOT protect against
 * catastrophic backtracking *inside a single* `exec()` (e.g. `(a+)+$`) — that
 * hangs before any iteration completes. Accepted: a bad pattern only freezes the
 * author's own panel until they edit it (single-user, local tool).
 */

import type { Note } from "../storage/NotesRepository";

export const MIN_QUERY_LENGTH = 2;
export const MAX_OCCURRENCES_PER_NOTE = 20;
/** Chars of context kept on each side of a match when building its snippet. */
export const SNIPPET_CONTEXT_CHARS = 40;
/**
 * Hard ceiling on match iterations per note — the runaway guard. Generous enough
 * never to be hit in normal use (≤7500 chars/note); only stops degenerate
 * many-match / zero-width loops.
 */
export const MAX_MATCH_ITERATIONS_PER_NOTE = 100_000;

export interface NoteMatch {
  /** Offset in `note.body` where the match begins. */
  start: number;
  /** Offset just past the match in `note.body` (`start + match length`). */
  end: number;
  /** Single-line context window around the match (whitespace collapsed). */
  snippet: string;
  /** Offset of the match *within* `snippet` (for emphasis). */
  matchStart: number;
  matchEnd: number;
}

export interface NoteSearchResult {
  id: string;
  title: string;
  /** Occurrences, ascending by `start`, capped to {@link MAX_OCCURRENCES_PER_NOTE}. */
  matches: NoteMatch[];
  /** True occurrence count before the cap (bounded by the iteration ceiling). */
  totalMatches: number;
}

export interface SearchOptions {
  /** When true, match case-sensitively (drop the `i` flag). Default false. */
  caseSensitive?: boolean;
}

/** Why a search produced no results, so the UI can render each case differently. */
export type SearchError = "too-short" | "invalid-regex";

export interface SearchOutcome {
  results: NoteSearchResult[];
  /** Non-null when the query couldn't run (too short / not a valid regex). */
  error: SearchError | null;
}

export type CompileResult = { ok: true; regex: RegExp } | { ok: false; error: SearchError };

/**
 * Compile the (trimmed) query into a global scanning `RegExp`, or report why it
 * can't run. The length check happens before construction so a too-short query
 * never reaches the regex engine. The `g` flag is always set (the scan iterates
 * via `lastIndex`); `i` is set unless `options.caseSensitive`.
 */
export function compileQuery(query: string, options: SearchOptions = {}): CompileResult {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return { ok: false, error: "too-short" };

  const flags = options.caseSensitive ? "g" : "gi";
  try {
    return { ok: true, regex: new RegExp(trimmed, flags) };
  } catch {
    // Any SyntaxError from an unbalanced/invalid pattern surfaces as an error state.
    return { ok: false, error: "invalid-regex" };
  }
}

/** Collapse every run of whitespace (incl. newlines) to a single space. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

/**
 * Build the single-line snippet + in-snippet match offsets for one occurrence.
 *
 * Context is clamped to the match's own line: the window never crosses a
 * user-entered newline, so text the user put on a *different* line never leaks
 * into the snippet (soft-wrapped long lines are one line here — that's fine).
 */
function buildSnippet(
  body: string,
  start: number,
  end: number,
): Pick<NoteMatch, "snippet" | "matchStart" | "matchEnd"> {
  // Line bounds around the match: just after the previous newline, up to the next one.
  const lineStart = body.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = body.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? body.length : nextNewline;

  const contextStart = Math.max(lineStart, start - SNIPPET_CONTEXT_CHARS);
  const contextEnd = Math.min(lineEnd, end + SNIPPET_CONTEXT_CHARS);
  // Ellipsis only when we truncated *within* the line (not at a natural line edge).
  const leadingEllipsis = contextStart > lineStart ? "…" : "";
  const trailingEllipsis = contextEnd < lineEnd ? "…" : "";

  // Collapse each part independently so the match boundaries stay exact; then
  // drop a single stray edge space collapse may have produced next to an ellipsis.
  const before = collapseWhitespace(body.slice(contextStart, start)).replace(/^ /, "");
  const match = collapseWhitespace(body.slice(start, end));
  const after = collapseWhitespace(body.slice(end, contextEnd)).replace(/ $/, "");

  const snippet = leadingEllipsis + before + match + after + trailingEllipsis;
  const matchStart = leadingEllipsis.length + before.length;
  return { snippet, matchStart, matchEnd: matchStart + match.length };
}

/**
 * Regex-based, body-only search. Returns only notes with ≥1 match, in the order
 * `notes` was given; occurrences within a note ascend by `start`. On a too-short
 * or invalid query, `results` is empty and `error` says which.
 */
export function searchNotes(query: string, notes: Note[], options: SearchOptions = {}): SearchOutcome {
  const compiled = compileQuery(query, options);
  if (!compiled.ok) return { results: [], error: compiled.error };
  const { regex } = compiled;

  const results: NoteSearchResult[] = [];
  for (const note of notes) {
    // The regex is shared across notes and carries `lastIndex`; reset per note.
    regex.lastIndex = 0;
    const matches: NoteMatch[] = [];
    let totalMatches = 0;
    let iterations = 0;

    for (let m = regex.exec(note.body); m !== null; m = regex.exec(note.body)) {
      // Runaway guard: bound total iterations (also caps degenerate zero-width loops).
      if (++iterations > MAX_MATCH_ITERATIONS_PER_NOTE) break;

      const start = m.index;
      const end = m.index + m[0].length;
      // Zero-width matches (^, \b, a*) are meaningless to show, and `exec` won't
      // advance `lastIndex` past them — bump it by hand or the loop never ends.
      if (end === start) {
        regex.lastIndex = start + 1;
        continue;
      }

      totalMatches++;
      if (matches.length < MAX_OCCURRENCES_PER_NOTE) {
        matches.push({ start, end, ...buildSnippet(note.body, start, end) });
      }
    }

    if (totalMatches > 0) {
      results.push({ id: note.id, title: note.title, matches, totalMatches });
    }
  }
  return { results, error: null };
}

/** A single navigable result row, tied to one occurrence in one note. */
export interface SearchRowRef {
  noteId: string;
  /** Index of the occurrence within its note's `matches` (the `onOpen` target). */
  matchIndex: number;
  /** Stable focus/highlight key — `${noteId}:${match.start}`, unique across results. */
  key: string;
}

/**
 * Flatten result groups into their top-to-bottom navigation order. Collapsed
 * groups contribute no rows (their occurrences aren't rendered), so arrow-key
 * navigation only visits rows the user can actually see.
 */
export function flattenSearchRows(results: NoteSearchResult[], collapsed: ReadonlySet<string>): SearchRowRef[] {
  const rows: SearchRowRef[] = [];
  for (const result of results) {
    if (collapsed.has(result.id)) continue;
    result.matches.forEach((match, matchIndex) => {
      rows.push({ noteId: result.id, matchIndex, key: `${result.id}:${match.start}` });
    });
  }
  return rows;
}
