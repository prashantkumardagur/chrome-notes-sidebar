import { describe, expect, it } from "vitest";
import { sortNotes } from "../../src/lib/notes/sort";
import type { NoteMeta } from "../../src/lib/storage/NotesRepository";

const meta = (id: string, title: string, updatedAt: number): NoteMeta => ({ id, title, updatedAt });

describe("sortNotes", () => {
  it("manual returns the input order as a copy, without mutating the input", () => {
    const input = [meta("a", "Zed", 1), meta("b", "Apple", 2)];
    const result = sortNotes(input, "manual");
    expect(result.map((n) => n.id)).toEqual(["a", "b"]);
    // A copy, not the same reference.
    expect(result).not.toBe(input);
    // Input untouched.
    expect(input.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("title sorts case-insensitively", () => {
    const input = [meta("c", "cherry", 1), meta("b", "Banana", 2), meta("a", "apple", 3)];
    expect(sortNotes(input, "title").map((n) => n.title)).toEqual(["apple", "Banana", "cherry"]);
  });

  it("title is stable for equal titles (keeps input order)", () => {
    const input = [meta("a", "Same", 1), meta("b", "same", 2), meta("c", "SAME", 3)];
    expect(sortNotes(input, "title").map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("updated sorts by updatedAt descending (newest first)", () => {
    const input = [meta("a", "A", 10), meta("b", "B", 30), meta("c", "C", 20)];
    expect(sortNotes(input, "updated").map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("never mutates the input for auto modes", () => {
    const input = [meta("a", "B", 1), meta("b", "A", 2)];
    sortNotes(input, "title");
    sortNotes(input, "updated");
    expect(input.map((n) => n.id)).toEqual(["a", "b"]);
  });
});
