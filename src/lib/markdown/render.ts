/**
 * Render GitHub-Flavored Markdown to sanitized HTML.
 *
 * Note content is untrusted, so the parsed HTML is always run through DOMPurify
 * before it reaches the DOM. Never bypass this to inject note content as raw HTML.
 */

import DOMPurify from "dompurify";
import type { LanguageFn } from "highlight.js";
// Import the core (no bundled grammars) plus one module per curated language — never the
// `highlight.js` default entry, which pulls in every grammar it ships and bloats the bundle.
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";

// Curated set for fenced code blocks (explicit-language only, no auto-detect — see
// docs/decisions.md). Extend by adding a language module + entry here. Each registration
// also registers hljs's own aliases (js/ts/py/yml/html/... resolve automatically).
const LANGUAGES: [name: string, grammar: LanguageFn][] = [
  ["javascript", javascript],
  ["typescript", typescript],
  ["python", python],
  ["bash", bash],
  ["json", json],
  ["xml", xml],
  ["css", css],
  ["markdown", markdown],
  ["sql", sql],
  ["yaml", yaml],
];

for (const [name, grammar] of LANGUAGES) {
  hljs.registerLanguage(name, grammar);
}
// hljs ships a separate "shell" grammar (console sessions) that we don't bundle; users
// typing ```shell almost always mean a plain script, so alias it to the bash grammar we do.
hljs.registerAliases("shell", { languageName: "bash" });

marked.setOptions({
  gfm: true,
  breaks: false,
});

marked.use(
  markedHighlight({
    // "hljs language-<x>" on <code> matches hljs's own convention; the per-token
    // `hljs-*` span classes (added by hljs.highlight below) are what's actually themed.
    langPrefix: "hljs language-",
    // Highlight only registered/aliased languages; anything else returns the code
    // unchanged (marked still escapes it), so unsupported/untagged fences render plain.
    // Never use highlightAuto here — that's the auto-detect path this feature rejects.
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "";
      return language ? hljs.highlight(code, { language }).value : code;
    },
  }),
);

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
