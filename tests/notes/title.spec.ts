import { describe, expect, it } from "vitest";
import { DEFAULT_NOTE_TITLE, nextUntitledTitle, normalizeTitle } from "../../src/lib/notes/title";

describe("nextUntitledTitle", () => {
  it("returns the base title when nothing is taken", () => {
    expect(nextUntitledTitle([])).toBe(DEFAULT_NOTE_TITLE);
    expect(nextUntitledTitle(["My note", "Ideas"])).toBe(DEFAULT_NOTE_TITLE);
  });

  it("appends the next free number when the base is taken", () => {
    expect(nextUntitledTitle(["Untitled"])).toBe("Untitled 2");
    expect(nextUntitledTitle(["Untitled", "Untitled 2"])).toBe("Untitled 3");
  });

  it("fills the lowest available gap", () => {
    expect(nextUntitledTitle(["Untitled", "Untitled 3"])).toBe("Untitled 2");
  });
});

describe("normalizeTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeTitle("  Shopping list  ")).toBe("Shopping list");
  });

  it("falls back to the default when empty or blank", () => {
    expect(normalizeTitle("")).toBe(DEFAULT_NOTE_TITLE);
    expect(normalizeTitle("   ")).toBe(DEFAULT_NOTE_TITLE);
  });
});
