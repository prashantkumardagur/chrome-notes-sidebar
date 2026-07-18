/**
 * Render GitHub-Flavored Markdown to sanitized HTML.
 *
 * Note content is untrusted, so the parsed HTML is always run through DOMPurify
 * before it reaches the DOM. Never bypass this to inject note content as raw HTML.
 */

import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

// Escape order matters: replace `&` first so we don't double-encode the
// entities produced by the `<`/`>` replacements.
function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

marked.use({
  renderer: {
    // Raw HTML in a note is untrusted and unwanted — render it as literal text,
    // not as live markup. Markdown-generated HTML (headings, tables, task lists,
    // md images) does NOT go through this hook, so it still renders.
    html(token) {
      // marked v18 passes a token object ({ text, raw, … }); older/newer
      // versions may pass a string — handle both so a version bump can't
      // silently render "[object Object]".
      const raw = typeof token === "string" ? token : token.text;
      return escapeHtml(raw);
    },
  },
});

/**
 * Convert a Markdown string to safe HTML.
 * @returns sanitized HTML ready to assign to `innerHTML`.
 */
export function renderMarkdown(source: string): string {
  const rawHtml = marked.parse(source ?? "", { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    // Allow GFM task-list checkboxes to render (they are disabled inputs).
    ADD_ATTR: ["checked", "disabled", "type"],
  });
}
