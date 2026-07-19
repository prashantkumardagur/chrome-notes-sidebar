/**
 * Pure Markdown text transformations for the editor's formatting toolbar +
 * shortcuts. No DOM access — the component owns reading/writing the textarea;
 * this module only computes the next text + selection.
 */

export type FormatAction =
  | "heading"
  | "bold"
  | "italic"
  | "strike"
  | "link"
  | "code"
  | "codeblock"
  | "quote"
  | "list"
  | "orderedList"
  | "checkList";

export interface FormatResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Marker wrapped around the selection for each inline action. */
const INLINE_MARKERS: Record<"bold" | "italic" | "strike" | "code", string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
};

/** Placeholder text/url inserted for a link with no selection. */
const LINK_TEXT_PLACEHOLDER = "text";
const LINK_URL_PLACEHOLDER = "url";

/**
 * Wrap [start, end) in `text` with `marker` on both sides, or unwrap it if the
 * chars immediately surrounding the selection already equal `marker` (toggle).
 * Empty selection inserts an empty pair with the caret between them.
 */
function inlineWrap(text: string, start: number, end: number, marker: string): FormatResult {
  const before = text.slice(Math.max(0, start - marker.length), start);
  const after = text.slice(end, end + marker.length);

  if (before === marker && after === marker) {
    // Already wrapped by this exact marker on both sides: unwrap (toggle off).
    const unwrapped = text.slice(0, start - marker.length) + text.slice(start, end) + text.slice(end + marker.length);
    const newStart = start - marker.length;
    const newEnd = end - marker.length;
    return { text: unwrapped, selectionStart: newStart, selectionEnd: newEnd };
  }

  const wrapped = text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end);
  if (start === end) {
    // Empty selection: caret lands between the two markers so typing starts inside them.
    const caret = start + marker.length;
    return { text: wrapped, selectionStart: caret, selectionEnd: caret };
  }
  // Non-empty selection: keep the original text selected, shifted past the opening marker.
  return { text: wrapped, selectionStart: start + marker.length, selectionEnd: end + marker.length };
}

/** Link action: wraps a selection as link text, or inserts a placeholder link. */
function applyLink(text: string, start: number, end: number): FormatResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  if (start === end) {
    const inserted = `[${LINK_TEXT_PLACEHOLDER}](${LINK_URL_PLACEHOLDER})`;
    const selectionStart = start + 1; // past "["
    const selectionEnd = selectionStart + LINK_TEXT_PLACEHOLDER.length;
    return { text: before + inserted + after, selectionStart, selectionEnd };
  }

  const inserted = `[${selected}]()`;
  // Caret between the empty parens, ready to type the URL.
  const caret = start + 1 + selected.length + 2;
  return { text: before + inserted + after, selectionStart: caret, selectionEnd: caret };
}

/**
 * Fenced code block: wraps the selection in ``` fences on their own lines, or
 * inserts an empty fenced block with the caret on the inner line. Leading/trailing
 * newlines are added only when the fences wouldn't already sit on their own line.
 */
function codeBlock(text: string, start: number, end: number): FormatResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  const lead = start > 0 && !before.endsWith("\n") ? "\n" : "";
  const trail = end < text.length && !after.startsWith("\n") ? "\n" : "";
  const block = `${lead}\`\`\`\n${selected}\n\`\`\`${trail}`;
  const newText = before + block + after;

  // Caret/selection lands on the inner content line: past `lead` + the "```\n" fence (4 chars).
  const innerStart = start + lead.length + 4;
  return { text: newText, selectionStart: innerStart, selectionEnd: innerStart + selected.length };
}

/**
 * Ordered-list action: numbers every line the selection touches (`1.`, `2.`, …),
 * or strips the numbering if every touched line already has it (toggle).
 */
function orderedList(text: string, start: number, end: number): FormatResult {
  const { lineStart, lineEnd } = lineSpan(text, start, end);
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const allNumbered = lines.every((line) => /^\d+\. /.test(line));
  const newLines = allNumbered
    ? lines.map((line) => line.replace(/^\d+\. /, ""))
    : lines.map((line, i) => `${i + 1}. ${line}`);
  const newSpan = newLines.join("\n");

  const newText = text.slice(0, lineStart) + newSpan + text.slice(lineEnd);
  return { text: newText, selectionStart: lineStart, selectionEnd: lineStart + newSpan.length };
}

/**
 * Line-prefix action (heading/list): prefixes every line the selection touches,
 * or strips the prefix if every touched line already has it (toggle). The
 * returned selection covers the whole modified line span.
 */
function linePrefix(text: string, start: number, end: number, prefix: string): FormatResult {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = text.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;

  const lines = text.slice(lineStart, lineEnd).split("\n");
  const allPrefixed = lines.every((line) => line.startsWith(prefix));
  const newLines = allPrefixed ? lines.map((line) => line.slice(prefix.length)) : lines.map((line) => prefix + line);
  const newSpan = newLines.join("\n");

  const newText = text.slice(0, lineStart) + newSpan + text.slice(lineEnd);
  return { text: newText, selectionStart: lineStart, selectionEnd: lineStart + newSpan.length };
}

/** Indent unit inserted by Tab in the editor: 2 spaces (matches the CSS `tab-size`). */
export const INDENT = "  ";

/** Line span [lineStart, lineEnd) covering every line the selection [start, end) touches. */
function lineSpan(text: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = text.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  return { lineStart, lineEnd };
}

/**
 * Tab: insert an indent at the caret (empty selection), or indent every line a
 * non-empty selection touches — keeping the selection over the same text.
 */
export function indent(text: string, start: number, end: number): FormatResult {
  if (start === end) {
    const newText = text.slice(0, start) + INDENT + text.slice(start);
    const caret = start + INDENT.length;
    return { text: newText, selectionStart: caret, selectionEnd: caret };
  }

  const { lineStart, lineEnd } = lineSpan(text, start, end);
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const newSpan = lines.map((line) => INDENT + line).join("\n");
  const newText = text.slice(0, lineStart) + newSpan + text.slice(lineEnd);
  // One indent lands before `start` (its own line); one lands before `end` for
  // every touched line, since each line begins at or before `end`.
  return {
    text: newText,
    selectionStart: start + INDENT.length,
    selectionEnd: end + INDENT.length * lines.length,
  };
}

/** Leading whitespace Shift+Tab strips from a line: one tab, or up to `INDENT.length` spaces. */
function leadingIndentWidth(line: string): number {
  if (line.startsWith("\t")) return 1;
  let n = 0;
  while (n < INDENT.length && line[n] === " ") n++;
  return n;
}

/**
 * Shift+Tab: outdent every line the selection touches, stripping one level of
 * leading indentation. Lines with no indent are left as-is; the selection is
 * shifted left to track the removed characters (clamped to each line's start).
 */
export function outdent(text: string, start: number, end: number): FormatResult {
  const { lineStart, lineEnd } = lineSpan(text, start, end);
  const lines = text.slice(lineStart, lineEnd).split("\n");

  let newStart = start;
  let newEnd = end;
  let cursor = lineStart; // start-of-line position in the original text
  const newLines = lines.map((line) => {
    const removed = leadingIndentWidth(line);
    if (removed > 0) {
      // Shift each end left only by the removed chars that sit before it on this line.
      if (start > cursor) newStart -= Math.min(removed, start - cursor);
      if (end > cursor) newEnd -= Math.min(removed, end - cursor);
    }
    cursor += line.length + 1; // + the "\n" that split() dropped
    return line.slice(removed);
  });

  const newSpan = newLines.join("\n");
  const newText = text.slice(0, lineStart) + newSpan + text.slice(lineEnd);
  return {
    text: newText,
    selectionStart: Math.max(lineStart, newStart),
    selectionEnd: Math.max(lineStart, newEnd),
  };
}

/** Apply a formatting action to `text` given the current selection. Pure. */
export function applyFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  action: FormatAction,
): FormatResult {
  switch (action) {
    case "bold":
    case "italic":
    case "strike":
    case "code":
      return inlineWrap(text, selectionStart, selectionEnd, INLINE_MARKERS[action]);
    case "link":
      return applyLink(text, selectionStart, selectionEnd);
    case "codeblock":
      return codeBlock(text, selectionStart, selectionEnd);
    case "heading":
      return linePrefix(text, selectionStart, selectionEnd, "# ");
    case "quote":
      return linePrefix(text, selectionStart, selectionEnd, "> ");
    case "list":
      return linePrefix(text, selectionStart, selectionEnd, "- ");
    case "checkList":
      return linePrefix(text, selectionStart, selectionEnd, "- [ ] ");
    case "orderedList":
      return orderedList(text, selectionStart, selectionEnd);
    default: {
      // Exhaustiveness guard: FormatAction is a closed union, so this is unreachable at compile time.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// Ordered by specificity: a task item ("- [ ] ") also matches the bullet pattern,
// so it must be tested first. Each captures the leading indent to carry it forward.
const TASK_MARKER = /^([ \t]*)([-*+]) \[[ xX]\] /;
const BULLET_MARKER = /^([ \t]*)([-*+]) /;
const ORDERED_MARKER = /^([ \t]*)(\d+)([.)]) /;
const QUOTE_MARKER = /^([ \t]*)> /;

/**
 * The list/quote marker to start the next line with, given the current line's text
 * up to the caret — or null if it isn't a continuable line. Indent is preserved; a
 * task item continues unchecked; an ordered item increments its number.
 */
function nextLineMarker(lineToCaret: string): string | null {
  let m = lineToCaret.match(TASK_MARKER);
  if (m) return `${m[1]}${m[2]} [ ] `;
  m = lineToCaret.match(BULLET_MARKER);
  if (m) return `${m[1]}${m[2]} `;
  m = lineToCaret.match(ORDERED_MARKER);
  if (m) return `${m[1]}${Number(m[2]) + 1}${m[3]} `;
  m = lineToCaret.match(QUOTE_MARKER);
  if (m) return `${m[1]}> `;
  return null;
}

/**
 * Enter inside a list/quote line: compute the newline + continued marker to insert,
 * or null to let the editor insert a plain newline. The user can backspace the
 * inserted marker to break out of the list.
 */
export function continueList(text: string, start: number, end: number): FormatResult | null {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const marker = nextLineMarker(text.slice(lineStart, start));
  if (marker === null) return null;

  const insert = `\n${marker}`;
  const newText = text.slice(0, start) + insert + text.slice(end);
  const caret = start + insert.length;
  return { text: newText, selectionStart: caret, selectionEnd: caret };
}
