/**
 * Pure, in-memory cross-note search.
 *
 * The dataset is tiny (≤10 notes × ≤7500 chars), so this is an exhaustive,
 * case-insensitive plain-substring scan over note *bodies* — no index, no
 * ranking, no storage. Titles are used only as group labels, never matched.
 *
 * Offsets (`start`/`end`) are returned even though phase 1 doesn't highlight,
 * because the follow-up highlighter task consumes exact body offsets — designing
 * the data model once here avoids reworking it later.
 */

import type { Note } from "../storage/NotesRepository";

export const MIN_QUERY_LENGTH = 2;
export const MAX_OCCURRENCES_PER_NOTE = 20;
/** Chars of context kept on each side of a match when building its snippet. */
export const SNIPPET_CONTEXT_CHARS = 40;

export interface NoteMatch {
  /** Offset in `note.body` where the match begins. */
  start: number;
  /** `start + query.length` — offset just past the match in `note.body`. */
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
  /** True occurrence count before the cap. */
  totalMatches: number;
}

/** Collapse every run of whitespace (incl. newlines) to a single space. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Build the single-line snippet + in-snippet match offsets for one occurrence. */
function buildSnippet(
  body: string,
  start: number,
  end: number,
): Pick<NoteMatch, "snippet" | "matchStart" | "matchEnd"> {
  const contextStart = Math.max(0, start - SNIPPET_CONTEXT_CHARS);
  const contextEnd = Math.min(body.length, end + SNIPPET_CONTEXT_CHARS);
  const leadingEllipsis = contextStart > 0 ? "…" : "";
  const trailingEllipsis = contextEnd < body.length ? "…" : "";

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
 * Case-insensitive, body-only substring search. Returns only notes with ≥1
 * match, in the order `notes` was given; occurrences within a note ascend by
 * `start`. Queries shorter than {@link MIN_QUERY_LENGTH} (after trimming) yield
 * an empty result.
 */
export function searchNotes(query: string, notes: Note[]): NoteSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY_LENGTH) return [];

  const results: NoteSearchResult[] = [];
  for (const note of notes) {
    const haystack = note.body.toLowerCase();
    const matches: NoteMatch[] = [];
    let totalMatches = 0;

    let from = 0;
    // Non-overlapping scan: advance past each hit (never by < 1) to avoid a loop.
    for (let idx = haystack.indexOf(needle, from); idx !== -1; idx = haystack.indexOf(needle, from)) {
      totalMatches++;
      const start = idx;
      const end = idx + needle.length;
      if (matches.length < MAX_OCCURRENCES_PER_NOTE) {
        matches.push({ start, end, ...buildSnippet(note.body, start, end) });
      }
      from = end > from ? end : from + 1;
    }

    if (totalMatches > 0) {
      results.push({ id: note.id, title: note.title, matches, totalMatches });
    }
  }
  return results;
}
