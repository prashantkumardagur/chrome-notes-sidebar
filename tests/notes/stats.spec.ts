import { describe, expect, it } from "vitest";
import { lineCount, wordCount } from "../../src/lib/notes/stats";

describe("wordCount", () => {
  it("returns 0 for empty text", () => {
    expect(wordCount("")).toBe(0);
  });

  it("returns 0 for whitespace-only text", () => {
    expect(wordCount("   ")).toBe(0);
  });

  it("counts a single word", () => {
    expect(wordCount("hello")).toBe(1);
  });

  it("counts multiple words", () => {
    expect(wordCount("hello world")).toBe(2);
  });

  it("collapses leading/trailing/multiple spaces and newlines", () => {
    expect(wordCount("  a\n b  c ")).toBe(3);
  });
});

describe("lineCount", () => {
  it("returns 0 for empty text", () => {
    expect(lineCount("")).toBe(0);
  });

  it("returns 1 for a single line", () => {
    expect(lineCount("a")).toBe(1);
  });

  it("counts multiple lines", () => {
    expect(lineCount("a\nb")).toBe(2);
  });

  it("counts a trailing newline as an extra empty segment", () => {
    expect(lineCount("a\n")).toBe(2);
  });

  it("counts a multi-line note correctly", () => {
    expect(lineCount("a\nb\nc\nd")).toBe(4);
  });
});
