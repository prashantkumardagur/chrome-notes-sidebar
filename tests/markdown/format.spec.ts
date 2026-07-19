import { describe, expect, it } from "vitest";
import { applyFormat } from "../../src/lib/markdown/format";

describe("applyFormat", () => {
  describe("bold", () => {
    it("wraps a non-empty selection", () => {
      const result = applyFormat("hello world", 0, 5, "bold");
      expect(result.text).toBe("**hello** world");
      expect(result.selectionStart).toBe(2);
      expect(result.selectionEnd).toBe(7);
    });

    it("inserts paired markers with the caret between them on an empty selection", () => {
      const result = applyFormat("hello world", 5, 5, "bold");
      expect(result.text).toBe("hello**** world");
      expect(result.selectionStart).toBe(7);
      expect(result.selectionEnd).toBe(7);
    });

    it("unwraps already-bolded text (toggle)", () => {
      const wrapped = applyFormat("hello world", 0, 5, "bold");
      const result = applyFormat(wrapped.text, wrapped.selectionStart, wrapped.selectionEnd, "bold");
      expect(result.text).toBe("hello world");
      expect(result.selectionStart).toBe(0);
      expect(result.selectionEnd).toBe(5);
    });
  });

  describe("italic", () => {
    it("wraps a non-empty selection", () => {
      const result = applyFormat("hello world", 6, 11, "italic");
      expect(result.text).toBe("hello *world*");
      expect(result.selectionStart).toBe(7);
      expect(result.selectionEnd).toBe(12);
    });

    it("inserts paired markers with the caret between them on an empty selection", () => {
      const result = applyFormat("", 0, 0, "italic");
      expect(result.text).toBe("**");
      expect(result.selectionStart).toBe(1);
      expect(result.selectionEnd).toBe(1);
    });

    it("unwraps already-italicized text (toggle)", () => {
      const wrapped = applyFormat("hello world", 6, 11, "italic");
      const result = applyFormat(wrapped.text, wrapped.selectionStart, wrapped.selectionEnd, "italic");
      expect(result.text).toBe("hello world");
      expect(result.selectionStart).toBe(6);
      expect(result.selectionEnd).toBe(11);
    });
  });

  describe("code", () => {
    it("wraps a non-empty selection", () => {
      const result = applyFormat("run npm test now", 4, 12, "code");
      expect(result.text).toBe("run `npm test` now");
      expect(result.selectionStart).toBe(5);
      expect(result.selectionEnd).toBe(13);
    });

    it("inserts paired markers with the caret between them on an empty selection", () => {
      const result = applyFormat("abc", 3, 3, "code");
      expect(result.text).toBe("abc``");
      expect(result.selectionStart).toBe(4);
      expect(result.selectionEnd).toBe(4);
    });

    it("unwraps already-coded text (toggle)", () => {
      const wrapped = applyFormat("run npm test now", 4, 12, "code");
      const result = applyFormat(wrapped.text, wrapped.selectionStart, wrapped.selectionEnd, "code");
      expect(result.text).toBe("run npm test now");
      expect(result.selectionStart).toBe(4);
      expect(result.selectionEnd).toBe(12);
    });

    it("does not toggle off on a partial selection inside a wrapped word (adjacency rule)", () => {
      // Selecting only "or" inside "`for`" — the char right before the selection is "f",
      // not the marker, so this must wrap rather than misfire an unwrap.
      const result = applyFormat("`for`", 2, 4, "code");
      expect(result.text).toBe("`f`or``");
      expect(result.text).not.toBe("`for`");
    });
  });

  describe("link", () => {
    it("inserts a placeholder link with the text placeholder selected on an empty selection", () => {
      const result = applyFormat("see  for details", 4, 4, "link");
      expect(result.text).toBe("see [text](url) for details");
      expect(result.selectionStart).toBe(5);
      expect(result.selectionEnd).toBe(9);
      expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe("text");
    });

    it("wraps a non-empty selection as link text with the caret inside the parens", () => {
      const result = applyFormat("see docs for details", 4, 8, "link");
      expect(result.text).toBe("see [docs]() for details");
      expect(result.selectionStart).toBe(result.selectionEnd);
      // Caret sits between "(" and ")".
      expect(result.text.slice(result.selectionStart - 1, result.selectionStart + 1)).toBe("()");
    });
  });

  describe("heading", () => {
    it("adds the prefix to a single line", () => {
      const result = applyFormat("hello world", 0, 5, "heading");
      expect(result.text).toBe("# hello world");
      expect(result.selectionStart).toBe(0);
      expect(result.selectionEnd).toBe(13);
    });

    it("prefixes every line touched by a multi-line selection", () => {
      const text = "one\ntwo\nthree";
      // Selection spans from inside "one" to inside "three".
      const result = applyFormat(text, 1, 10, "heading");
      expect(result.text).toBe("# one\n# two\n# three");
    });

    it("removes the prefix when every touched line already has it (toggle)", () => {
      const text = "# one\n# two\n# three";
      const result = applyFormat(text, 1, 15, "heading");
      expect(result.text).toBe("one\ntwo\nthree");
    });

    it("recomputes the selection to cover the modified line span", () => {
      const text = "one\ntwo\nthree";
      const result = applyFormat(text, 5, 6, "heading"); // caret inside "two"
      expect(result.text).toBe("one\n# two\nthree");
      expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe("# two");
    });
  });

  describe("list", () => {
    it("adds the prefix to a single line", () => {
      const result = applyFormat("item one", 0, 4, "list");
      expect(result.text).toBe("- item one");
    });

    it("prefixes every line touched by a multi-line selection", () => {
      const text = "a\nb\nc";
      const result = applyFormat(text, 0, 5, "list");
      expect(result.text).toBe("- a\n- b\n- c");
    });

    it("removes the prefix when every touched line already has it (toggle)", () => {
      const text = "- a\n- b\n- c";
      const result = applyFormat(text, 0, text.length, "list");
      expect(result.text).toBe("a\nb\nc");
    });

    it("does not toggle off when only some touched lines have the prefix", () => {
      const text = "- a\nb\n- c";
      const result = applyFormat(text, 0, text.length, "list");
      expect(result.text).toBe("- - a\n- b\n- - c");
    });
  });

  describe("idempotence / round-trip", () => {
    it("bold apply then re-apply returns the original text and selection", () => {
      const original = "hello world";
      const applied = applyFormat(original, 0, 5, "bold");
      const reverted = applyFormat(applied.text, applied.selectionStart, applied.selectionEnd, "bold");
      expect(reverted.text).toBe(original);
      expect(reverted.selectionStart).toBe(0);
      expect(reverted.selectionEnd).toBe(5);
    });

    it("heading apply then re-apply returns the original text", () => {
      const original = "one\ntwo\nthree";
      const applied = applyFormat(original, 0, original.length, "heading");
      const reverted = applyFormat(applied.text, applied.selectionStart, applied.selectionEnd, "heading");
      expect(reverted.text).toBe(original);
    });

    it("list apply then re-apply returns the original text", () => {
      const original = "a\nb\nc";
      const applied = applyFormat(original, 0, original.length, "list");
      const reverted = applyFormat(applied.text, applied.selectionStart, applied.selectionEnd, "list");
      expect(reverted.text).toBe(original);
    });
  });
});
