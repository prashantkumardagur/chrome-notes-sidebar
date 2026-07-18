import { describe, expect, it } from "vitest";
import { MAX_OCCURRENCES_PER_NOTE, MIN_QUERY_LENGTH, searchNotes } from "../../src/lib/search/search";
import type { Note } from "../../src/lib/storage/NotesRepository";

/** Build a Note with sensible defaults; only id/title/body matter for search. */
function note(id: string, title: string, body: string): Note {
  return { id, title, body, createdAt: 0, updatedAt: 0 };
}

describe("searchNotes", () => {
  it("returns [] for a query shorter than MIN_QUERY_LENGTH", () => {
    const notes = [note("1", "A", "hello world")];
    expect(searchNotes("", notes)).toEqual([]);
    expect(searchNotes("h", notes)).toEqual([]);
    // Whitespace-only / trims below the minimum.
    expect(searchNotes("  ", notes)).toEqual([]);
    expect(searchNotes(" h ", notes)).toEqual([]);
    // Exactly MIN_QUERY_LENGTH is allowed.
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(searchNotes("he", notes)).toHaveLength(1);
  });

  it("finds a single match with correct offsets and snippet", () => {
    const results = searchNotes("world", [note("1", "A", "hello world here")]);
    expect(results).toHaveLength(1);
    const [r] = results;
    expect(r).toMatchObject({ id: "1", title: "A", totalMatches: 1 });
    expect(r.matches).toHaveLength(1);

    const m = r.matches[0];
    expect(m.start).toBe(6);
    expect(m.end).toBe(11);
    // The snippet contains the match and the in-snippet offsets index it.
    expect(m.snippet).toContain("world");
    expect(m.snippet.slice(m.matchStart, m.matchEnd)).toBe("world");
  });

  it("is case-insensitive and preserves the body's original casing in the snippet", () => {
    const n = note("1", "A", "TODO and ToDo and todo");
    const results = searchNotes("todo", [n]);
    expect(results).toHaveLength(1);
    const [r] = results;
    expect(r.totalMatches).toBe(3);
    expect(r.matches.map((m) => n.body.slice(m.start, m.end))).toEqual(["TODO", "ToDo", "todo"]);
    // Each snippet's emphasized slice reflects the actual (mixed-case) body text.
    for (const m of r.matches) {
      expect(m.snippet.slice(m.matchStart, m.matchEnd).toLowerCase()).toBe("todo");
    }
  });

  it("returns multiple occurrences ascending by start with a correct total", () => {
    const results = searchNotes("ab", [note("1", "A", "ab_ab_ab")]);
    const [r] = results;
    expect(r.totalMatches).toBe(3);
    expect(r.matches.map((m) => m.start)).toEqual([0, 3, 6]);
    // Strictly ascending.
    const starts = r.matches.map((m) => m.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("does not match overlapping occurrences (scan advances past each hit)", () => {
    // "aa" in "aaaa": non-overlapping matches at 0 and 2 only.
    const [r] = searchNotes("aa", [note("1", "A", "aaaa")]);
    expect(r.totalMatches).toBe(2);
    expect(r.matches.map((m) => m.start)).toEqual([0, 2]);
  });

  it("caps matches at MAX_OCCURRENCES_PER_NOTE but reports the true total", () => {
    const total = MAX_OCCURRENCES_PER_NOTE + 5;
    const body = "xy ".repeat(total); // "xy xy xy ..." → `total` occurrences of "xy"
    const [r] = searchNotes("xy", [note("1", "A", body)]);
    expect(r.matches).toHaveLength(MAX_OCCURRENCES_PER_NOTE);
    expect(r.totalMatches).toBe(total);
  });

  it("truncates long bodies, collapses whitespace, and adds ellipses only when cut", () => {
    const long = `${"a".repeat(100)}\n\n  NEEDLE  \t${"b".repeat(100)}`;
    const [r] = searchNotes("needle", [note("1", "A", long)]);
    const m = r.matches[0];
    // No raw newlines/tabs survive; runs collapsed to single spaces.
    expect(m.snippet).not.toMatch(/[\n\t]/);
    expect(m.snippet).not.toMatch(/ {2,}/);
    // Cut on both sides → leading and trailing ellipsis.
    expect(m.snippet.startsWith("…")).toBe(true);
    expect(m.snippet.endsWith("…")).toBe(true);
    expect(m.snippet.slice(m.matchStart, m.matchEnd)).toBe("NEEDLE");
  });

  it("omits ellipses for a short body and keeps offsets in range", () => {
    const [r] = searchNotes("cat", [note("1", "A", "a cat sat")]);
    const m = r.matches[0];
    expect(m.snippet).toBe("a cat sat");
    expect(m.snippet).not.toContain("…");
    expect(m.matchStart).toBeGreaterThanOrEqual(0);
    expect(m.matchEnd).toBeLessThanOrEqual(m.snippet.length);
    expect(m.snippet.slice(m.matchStart, m.matchEnd)).toBe("cat");
  });

  it("returns notes in input order and drops notes with no match", () => {
    const notes = [
      note("1", "First", "nothing relevant"),
      note("2", "Second", "has apple inside"),
      note("3", "Third", "apple again apple"),
    ];
    const results = searchNotes("apple", notes);
    expect(results.map((r) => r.id)).toEqual(["2", "3"]);
    expect(results[1].totalMatches).toBe(2);
  });

  it("returns [] when nothing matches and does not error on empty bodies", () => {
    const notes = [note("1", "Empty", ""), note("2", "B", "some text")];
    expect(searchNotes("zzz", notes)).toEqual([]);
    // Empty-body note simply yields no matches.
    expect(searchNotes("some", notes).map((r) => r.id)).toEqual(["2"]);
  });
});
