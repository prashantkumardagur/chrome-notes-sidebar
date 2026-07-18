import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/lib/markdown/render";

describe("renderMarkdown (GFM)", () => {
  it("renders headings", () => {
    expect(renderMarkdown("# Hello")).toContain("<h1>Hello</h1>");
  });

  it("renders emphasis and inline code", () => {
    const html = renderMarkdown("**bold** _italic_ `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("renders GFM tables", () => {
    const md = ["| A | B |", "| - | - |", "| 1 | 2 |"].join("\n");
    const html = renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders task lists as checkboxes", () => {
    const html = renderMarkdown("- [x] done\n- [ ] todo");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("renders fenced code blocks", () => {
    const html = renderMarkdown("```\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("const x = 1;");
  });

  it("renders Markdown image syntax as a real <img>", () => {
    const html = renderMarkdown("![a](https://e/x.png)");
    expect(html).toContain('src="https://e/x.png"');
    expect(html).toContain("<img");
  });

  it("handles empty / nullish input safely", () => {
    expect(renderMarkdown("")).toBe("");
    // @ts-expect-error exercising defensive nullish handling
    expect(renderMarkdown(undefined)).toBe("");
  });

  describe("raw HTML rendered as literal text", () => {
    it("escapes raw inline HTML", () => {
      const html = renderMarkdown("a <b>x</b> b");
      expect(html).toContain("&lt;b&gt;");
      expect(html).not.toContain("<b>");
    });

    it("escapes raw block HTML", () => {
      const html = renderMarkdown("<div>x</div>");
      expect(html).toContain("&lt;div&gt;");
      expect(html).not.toContain("<div>");
    });

    it("escapes a hand-typed <input> but keeps Markdown task-list checkboxes", () => {
      // A raw <input> typed into a note is rendered as text, not a live input…
      const rawInput = renderMarkdown('<input type="checkbox">');
      expect(rawInput).toContain("&lt;input");
      expect(rawInput).not.toContain("<input");

      // …while a Markdown task list still produces a real checkbox input.
      const taskList = renderMarkdown("- [ ] todo");
      expect(taskList).toContain('type="checkbox"');
    });
  });

  describe("sanitization (untrusted content)", () => {
    it("escapes raw <script> tags to inert text (never a live element)", () => {
      // Raw HTML is now escaped upstream of DOMPurify, so a <script> can never
      // become a live element — it shows as literal, non-executable text.
      const html = renderMarkdown("Hi<script>alert(1)</script>");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("escapes raw inline event handlers to inert text (no live element)", () => {
      // The raw <img onerror=…> is escaped, so no live <img>/onerror attribute
      // reaches the DOM; the handler survives only as harmless literal text.
      const html = renderMarkdown('<img src=x onerror="alert(1)">');
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img");
    });

    it("drops javascript: URLs from Markdown-generated links (DOMPurify still required)", () => {
      // A Markdown link produces a real <a href="javascript:…">, which is NOT
      // raw HTML — DOMPurify, not the escape hook, is what strips it.
      const html = renderMarkdown("[click](javascript:alert(1))");
      expect(html).not.toContain("javascript:");
    });
  });
});
