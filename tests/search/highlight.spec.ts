import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "../../src/lib/markdown/render";
import { clearViewHighlights, highlightMatchesInView, selectRangeInTextarea } from "../../src/lib/search/highlight";

/** Build a real rendered-Markdown container, matching what MarkdownView holds. */
function viewFrom(source: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = renderMarkdown(source);
  return el;
}

function hits(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("mark.search-hit")];
}

describe("highlightMatchesInView", () => {
  it("wraps every case-insensitive occurrence of the query", () => {
    const el = viewFrom("Alpha alpha ALPHA beta");
    const count = highlightMatchesInView(el, "alpha", 0);

    expect(count).toBe(3);
    const marks = hits(el);
    expect(marks).toHaveLength(3);
    for (const m of marks) expect(m.textContent?.toLowerCase()).toBe("alpha");
  });

  it("preserves the original case of each matched occurrence", () => {
    const el = viewFrom("Alpha alpha ALPHA");
    highlightMatchesInView(el, "alpha", 0);
    expect(hits(el).map((m) => m.textContent)).toEqual(["Alpha", "alpha", "ALPHA"]);
  });

  it("highlights occurrences spread across multiple elements/text nodes", () => {
    const el = viewFrom("# needle\n\nsome needle here\n\n- needle item");
    const count = highlightMatchesInView(el, "needle", 0);
    expect(count).toBe(3);
    // The three marks live under different block elements, not one text node.
    const parents = new Set(hits(el).map((m) => m.parentElement?.tagName));
    expect(parents.size).toBeGreaterThan(1);
  });

  it("does not double-wrap on a second run", () => {
    const el = viewFrom("alpha alpha alpha");
    expect(highlightMatchesInView(el, "alpha", 0)).toBe(3);
    // Re-running skips text already inside a highlight; nothing new is wrapped.
    expect(highlightMatchesInView(el, "alpha", 0)).toBe(0);
    expect(hits(el)).toHaveLength(3);
  });

  it("returns 0 and wraps nothing for an empty query", () => {
    const el = viewFrom("anything");
    expect(highlightMatchesInView(el, "", 0)).toBe(0);
    expect(hits(el)).toHaveLength(0);
  });

  it("does not throw when scrollIntoView is unavailable (jsdom)", () => {
    const el = viewFrom("alpha alpha");
    // jsdom leaves scrollIntoView undefined; the function must guard the call so it
    // doesn't throw while still returning the highlight count.
    expect(() => highlightMatchesInView(el, "alpha", 1)).not.toThrow();
    expect(hits(el)).toHaveLength(2);
  });

  it("scrolls the occurrence at the clamped nearestIndex into view", () => {
    const el = viewFrom("alpha alpha alpha alpha");
    // Give every future <mark> a spy-able scrollIntoView.
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      highlightMatchesInView(el, "alpha", 2);
      const marks = hits(el);
      expect(scroll).toHaveBeenCalledTimes(1);
      // The scrolled element is the 3rd occurrence (index 2), centered.
      expect(scroll.mock.instances[0]).toBe(marks[2]);
      expect(scroll).toHaveBeenCalledWith({ block: "center" });
      // Only that occurrence is marked active; the rest are plain highlights.
      expect(marks[2].classList.contains("search-hit-active")).toBe(true);
      const active = marks.filter((m) => m.classList.contains("search-hit-active"));
      expect(active).toEqual([marks[2]]);
    } finally {
      // Restore the jsdom default (scrollIntoView absent).
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it("clamps an out-of-range nearestIndex to the last occurrence", () => {
    const el = viewFrom("alpha alpha");
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      highlightMatchesInView(el, "alpha", 99);
      expect(scroll.mock.instances[0]).toBe(hits(el)[1]);
    } finally {
      // Restore the jsdom default (scrollIntoView absent).
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe("clearViewHighlights", () => {
  it("restores the container to its pre-highlight text", () => {
    const el = viewFrom("the alpha and the alpha again");
    const before = el.innerHTML;
    highlightMatchesInView(el, "alpha", 0);
    expect(hits(el)).toHaveLength(2);

    clearViewHighlights(el);
    expect(hits(el)).toHaveLength(0);
    expect(el.innerHTML).toBe(before);
  });

  it("merges the split text back into single text nodes", () => {
    const el = document.createElement("div");
    const p = document.createElement("p");
    p.textContent = "alpha alpha";
    el.appendChild(p);

    highlightMatchesInView(el, "alpha", 0);
    clearViewHighlights(el);

    expect(p.childNodes).toHaveLength(1);
    expect(p.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(p.textContent).toBe("alpha alpha");
  });
});

describe("selectRangeInTextarea", () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    textarea = document.createElement("textarea");
    textarea.value = "hello wonderful world";
    document.body.appendChild(textarea);
  });

  it("selects the requested range and focuses the textarea", () => {
    selectRangeInTextarea(textarea, 6, 15);
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(15);
    expect(document.activeElement).toBe(textarea);
    expect(textarea.value.slice(6, 15)).toBe("wonderful");
  });
});
