import { describe, expect, it } from "vitest";
import {
  compileQuery,
  flattenSearchRows,
  MAX_OCCURRENCES_PER_NOTE,
  MIN_QUERY_LENGTH,
  type SearchOptions,
  searchNotes,
} from "../../src/lib/search/search";
import type { Note } from "../../src/lib/storage/NotesRepository";

/** Build a Note with sensible defaults; only id/title/body matter for search. */
function note(id: string, title: string, body: string): Note {
  return { id, title, body, createdAt: 0, updatedAt: 0 };
}

/** Convenience: run a search and return just the results array. */
function run(query: string, notes: Note[], options?: SearchOptions) {
  return searchNotes(query, notes, options).results;
}

describe("compileQuery", () => {
  it("reports too-short for queries under MIN_QUERY_LENGTH (after trimming)", () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(compileQuery("")).toEqual({ ok: false, error: "too-short" });
    expect(compileQuery("a")).toEqual({ ok: false, error: "too-short" });
    expect(compileQuery("  ")).toEqual({ ok: false, error: "too-short" });
    expect(compileQuery(" a ")).toEqual({ ok: false, error: "too-short" });
  });

  it("reports invalid-regex for syntactically broken patterns (that clear the length gate)", () => {
    // All ≥ MIN_QUERY_LENGTH so they reach the regex engine (a 1-char broken
    // pattern like "(" reports too-short first — covered above).
    for (const bad of ["a(", "a[", "a\\", "(?<", "*ab"]) {
      expect(compileQuery(bad)).toEqual({ ok: false, error: "invalid-regex" });
    }
  });

  it("compiles a valid pattern with the g flag, plus i unless case-sensitive", () => {
    const ci = compileQuery("foo.*bar");
    expect(ci.ok).toBe(true);
    if (ci.ok) {
      expect(ci.regex.global).toBe(true);
      expect(ci.regex.ignoreCase).toBe(true);
    }
    const cs = compileQuery("foo", { caseSensitive: true });
    expect(cs.ok).toBe(true);
    if (cs.ok) {
      expect(cs.regex.global).toBe(true);
      expect(cs.regex.ignoreCase).toBe(false);
    }
  });
});

describe("searchNotes", () => {
  it("returns a too-short error for a query shorter than MIN_QUERY_LENGTH", () => {
    const notes = [note("1", "A", "hello world")];
    expect(searchNotes("", notes)).toEqual({ results: [], error: "too-short" });
    expect(searchNotes("h", notes)).toEqual({ results: [], error: "too-short" });
    expect(searchNotes("  ", notes)).toEqual({ results: [], error: "too-short" });
    // Exactly MIN_QUERY_LENGTH is allowed and runs.
    expect(searchNotes("he", notes).results).toHaveLength(1);
    expect(searchNotes("he", notes).error).toBeNull();
  });

  it("returns an invalid-regex error for a broken pattern", () => {
    const notes = [note("1", "A", "hello world")];
    expect(searchNotes("a(", notes)).toEqual({ results: [], error: "invalid-regex" });
    expect(searchNotes("a\\", notes)).toEqual({ results: [], error: "invalid-regex" });
  });

  it("finds a single match with correct offsets and snippet", () => {
    const { results, error } = searchNotes("world", [note("1", "A", "hello world here")]);
    expect(error).toBeNull();
    expect(results).toHaveLength(1);
    const [r] = results;
    expect(r).toMatchObject({ id: "1", title: "A", totalMatches: 1 });
    expect(r.matches).toHaveLength(1);

    const m = r.matches[0];
    expect(m.start).toBe(6);
    expect(m.end).toBe(11);
    expect(m.snippet).toContain("world");
    expect(m.snippet.slice(m.matchStart, m.matchEnd)).toBe("world");
  });

  it("is case-insensitive by default and preserves the body's original casing", () => {
    const n = note("1", "A", "TODO and ToDo and todo");
    const [r] = run("todo", [n]);
    expect(r.totalMatches).toBe(3);
    expect(r.matches.map((m) => n.body.slice(m.start, m.end))).toEqual(["TODO", "ToDo", "todo"]);
    for (const m of r.matches) {
      expect(m.snippet.slice(m.matchStart, m.matchEnd).toLowerCase()).toBe("todo");
    }
  });

  it("respects the caseSensitive option", () => {
    const n = note("1", "A", "TODO and ToDo and todo");
    const [r] = run("TODO", [n], { caseSensitive: true });
    // Only the exact-case occurrence matches.
    expect(r.totalMatches).toBe(1);
    expect(n.body.slice(r.matches[0].start, r.matches[0].end)).toBe("TODO");
    // A lowercase query finds nothing case-sensitively.
    expect(run("todo", [n], { caseSensitive: true })[0].totalMatches).toBe(1);
  });

  it("matches regex metacharacters as patterns", () => {
    const body = "order 42 and 7 pending";
    const digits = run("\\d+", [note("1", "A", body)]);
    expect(digits[0].matches.map((m) => body.slice(m.start, m.end))).toEqual(["42", "7"]);

    // Greedy across a single line.
    const glob = run("foo.*bar", [note("1", "A", "foo middle bar")]);
    expect(glob[0].matches.map((m) => "foo middle bar".slice(m.start, m.end))).toEqual(["foo middle bar"]);

    // Character class.
    const vowels = run("[aeiou]", [note("1", "A", "sky")]);
    expect(vowels).toEqual([]);
    expect(run("[aeiou]", [note("1", "A", "cat")])[0].totalMatches).toBe(1);
  });

  it("anchors ^/$ against the whole body (no m flag), not per line", () => {
    const body = "abc\ndef";
    // ^ matches only at offset 0.
    expect(run("^abc", [note("1", "A", body)])[0].matches[0].start).toBe(0);
    // A mid-body line start is NOT matched by ^.
    expect(run("^def", [note("1", "A", body)])).toEqual([]);
  });

  it("captures a variable-length match fully in its snippet", () => {
    const body = `heading\n${"x".repeat(50)} 2024-01-15 ${"y".repeat(50)}\nfooter`;
    const [r] = run("\\d{4}-\\d{2}-\\d{2}", [note("1", "A", body)]);
    const m = r.matches[0];
    expect(body.slice(m.start, m.end)).toBe("2024-01-15");
    expect(m.snippet.slice(m.matchStart, m.matchEnd)).toBe("2024-01-15");
    // Bounded snippet, same line only, ellipses where cut.
    expect(m.snippet).not.toContain("heading");
    expect(m.snippet).not.toContain("footer");
    expect(m.snippet.startsWith("…")).toBe(true);
    expect(m.snippet.endsWith("…")).toBe(true);
  });

  it("returns multiple occurrences ascending by start with a correct total", () => {
    const [r] = run("ab", [note("1", "A", "ab_ab_ab")]);
    expect(r.totalMatches).toBe(3);
    expect(r.matches.map((m) => m.start)).toEqual([0, 3, 6]);
  });

  it("does not match overlapping occurrences (scan advances past each hit)", () => {
    const [r] = run("aa", [note("1", "A", "aaaa")]);
    expect(r.totalMatches).toBe(2);
    expect(r.matches.map((m) => m.start)).toEqual([0, 2]);
  });

  it("skips zero-width matches and terminates", () => {
    // `a*` matches empty between non-a chars — those must not be emitted, and the
    // scan must still terminate (advancing lastIndex by hand past empties).
    const [r] = run("a*", [note("1", "A", "banana")]);
    expect(r.matches.every((m) => m.end > m.start)).toBe(true);
    expect(r.matches.map((m) => "banana".slice(m.start, m.end))).toEqual(["a", "a", "a"]);

    // A purely zero-width pattern yields no results (and doesn't hang).
    expect(run("\\b", [note("1", "A", "some words here")])).toEqual([]);
  });

  it("caps matches at MAX_OCCURRENCES_PER_NOTE but reports the true total", () => {
    const total = MAX_OCCURRENCES_PER_NOTE + 5;
    const body = "xy ".repeat(total);
    const [r] = run("xy", [note("1", "A", body)]);
    expect(r.matches).toHaveLength(MAX_OCCURRENCES_PER_NOTE);
    expect(r.totalMatches).toBe(total);
  });

  it("bounds a degenerate many-match pattern (iteration ceiling) without hanging", () => {
    // `..` matches ~125k times here — more than MAX_MATCH_ITERATIONS_PER_NOTE, so
    // the ceiling trips. It must return promptly with the display capped at 20 rows.
    const body = "a".repeat(250_000);
    const [r] = run("..", [note("1", "A", body)]);
    expect(r.matches).toHaveLength(MAX_OCCURRENCES_PER_NOTE);
  });

  it("truncates long lines, collapses whitespace, and adds ellipses only when cut", () => {
    const line = `${"x".repeat(60)}  NEEDLE \t${"y".repeat(60)}`;
    const [r] = run("needle", [note("1", "A", `heading\n${line}\nfooter`)]);
    const m = r.matches[0];
    expect(m.snippet).not.toMatch(/[\n\t]/);
    expect(m.snippet).not.toMatch(/ {2,}/);
    expect(m.snippet.startsWith("…")).toBe(true);
    expect(m.snippet.endsWith("…")).toBe(true);
    expect(m.snippet.slice(m.matchStart, m.matchEnd)).toBe("NEEDLE");
  });

  it("clamps the snippet to the match's own line (no other lines leak in)", () => {
    const body = "alpha line above\nbeta target gamma\ndelta line below";
    const [r] = run("target", [note("1", "A", body)]);
    const m = r.matches[0];
    expect(m.snippet).toBe("beta target gamma");
    expect(m.snippet).not.toContain("alpha");
    expect(m.snippet).not.toContain("delta");
    expect(m.snippet.slice(m.matchStart, m.matchEnd)).toBe("target");
  });

  it("does not add a leading ellipsis when the match starts its line", () => {
    const body = `prior line\ntarget then a fairly long tail ${"z".repeat(80)}`;
    const [r] = run("target", [note("1", "A", body)]);
    const m = r.matches[0];
    expect(m.snippet.startsWith("…")).toBe(false);
    expect(m.snippet.startsWith("target")).toBe(true);
    expect(m.snippet.endsWith("…")).toBe(true);
    expect(m.snippet).not.toContain("prior");
  });

  it("omits ellipses for a short body and keeps offsets in range", () => {
    const [r] = run("cat", [note("1", "A", "a cat sat")]);
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
    const results = run("apple", notes);
    expect(results.map((r) => r.id)).toEqual(["2", "3"]);
    expect(results[1].totalMatches).toBe(2);
  });

  it("returns no results when nothing matches and does not error on empty bodies", () => {
    const notes = [note("1", "Empty", ""), note("2", "B", "some text")];
    expect(searchNotes("zzz", notes)).toEqual({ results: [], error: null });
    expect(run("some", notes).map((r) => r.id)).toEqual(["2"]);
  });
});

describe("flattenSearchRows", () => {
  it("flattens groups into top-to-bottom order with stable per-occurrence keys", () => {
    const notes = [note("2", "Second", "has apple inside"), note("3", "Third", "apple again apple")];
    const results = searchNotes("apple", notes).results;
    const rows = flattenSearchRows(results, new Set());
    expect(rows.map((r) => r.noteId)).toEqual(["2", "3", "3"]);
    expect(rows.map((r) => r.matchIndex)).toEqual([0, 0, 1]);
    // Keys are `${noteId}:${match.start}` and unique across the flattened list.
    expect(rows.map((r) => r.key)).toEqual([
      `2:${results[0].matches[0].start}`,
      `3:${results[1].matches[0].start}`,
      `3:${results[1].matches[1].start}`,
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it("omits rows for collapsed groups (their occurrences aren't rendered)", () => {
    const notes = [note("2", "Second", "has apple inside"), note("3", "Third", "apple again apple")];
    const results = searchNotes("apple", notes).results;
    const rows = flattenSearchRows(results, new Set(["2"]));
    expect(rows.map((r) => r.noteId)).toEqual(["3", "3"]);
  });

  it("returns an empty list when there are no results", () => {
    expect(flattenSearchRows([], new Set())).toEqual([]);
  });
});
