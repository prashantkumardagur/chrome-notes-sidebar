import { describe, expect, it } from "vitest";
import { toggleTaskAtIndex } from "../../src/lib/markdown/tasks";

describe("toggleTaskAtIndex", () => {
  it("flips a single task from unchecked to checked and back", () => {
    expect(toggleTaskAtIndex("- [ ] todo", 0)).toBe("- [x] todo");
    expect(toggleTaskAtIndex("- [x] todo", 0)).toBe("- [ ] todo");
  });

  it("toggles only the marker at the given index, leaving others untouched", () => {
    const source = ["- [ ] one", "- [ ] two", "- [ ] three"].join("\n");
    expect(toggleTaskAtIndex(source, 2)).toBe(["- [ ] one", "- [ ] two", "- [x] three"].join("\n"));
  });

  it("preserves surrounding text and indentation byte-for-byte", () => {
    const source = "  - [ ]   deeply spaced   todo  ";
    expect(toggleTaskAtIndex(source, 0)).toBe("  - [x]   deeply spaced   todo  ");
  });

  it("counts all bullet variants (-, *, +) in document order", () => {
    const source = ["- [ ] dash", "* [ ] star", "+ [ ] plus"].join("\n");
    expect(toggleTaskAtIndex(source, 1)).toBe(["- [ ] dash", "* [x] star", "+ [ ] plus"].join("\n"));
  });

  it("counts ordered task items (1. and 1)) in document order", () => {
    const source = ["1. [ ] first", "2) [ ] second"].join("\n");
    expect(toggleTaskAtIndex(source, 0)).toBe(["1. [x] first", "2) [ ] second"].join("\n"));
    expect(toggleTaskAtIndex(source, 1)).toBe(["1. [ ] first", "2) [x] second"].join("\n"));
  });

  it("maps indented / nested task items to the right index", () => {
    const source = ["- [ ] parent", "  - [ ] child", "  - [ ] sibling"].join("\n");
    expect(toggleTaskAtIndex(source, 1)).toBe(["- [ ] parent", "  - [x] child", "  - [ ] sibling"].join("\n"));
  });

  it("treats [X] (uppercase) as checked and unchecks it to [ ]", () => {
    expect(toggleTaskAtIndex("- [X] done", 0)).toBe("- [ ] done");
  });

  it("returns the source unchanged for an out-of-range index", () => {
    const source = "- [ ] only";
    expect(toggleTaskAtIndex(source, 5)).toBe(source);
    expect(toggleTaskAtIndex(source, -1)).toBe(source);
  });

  it("does not match a [ ] that appears mid-line (line-anchored)", () => {
    const source = "this is not a task [ ] in the middle";
    expect(toggleTaskAtIndex(source, 0)).toBe(source);
  });

  it("ignores non-task list items when counting", () => {
    const source = ["- plain item", "- [ ] real task"].join("\n");
    expect(toggleTaskAtIndex(source, 0)).toBe(["- plain item", "- [x] real task"].join("\n"));
  });
});
