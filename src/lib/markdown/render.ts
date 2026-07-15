/**
 * Render GitHub-Flavored Markdown to sanitized HTML.
 *
 * Note content is untrusted, so the parsed HTML is always run through DOMPurify
 * before it reaches the DOM. Never bypass this to inject note content as raw HTML.
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Convert a Markdown string to safe HTML.
 * @returns sanitized HTML ready to assign to `innerHTML`.
 */
export function renderMarkdown(source: string): string {
  const rawHtml = marked.parse(source ?? '', { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    // Allow GFM task-list checkboxes to render (they are disabled inputs).
    ADD_ATTR: ['checked', 'disabled', 'type'],
  });
}
