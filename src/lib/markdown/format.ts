/**
 * Pure Markdown text transformations for the editor's formatting toolbar +
 * shortcuts. No DOM access — the component owns reading/writing the textarea;
 * this module only computes the next text + selection.
 */

export type FormatAction = "bold" | "italic" | "code" | "link" | "heading" | "list";

export interface FormatResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Marker wrapped around the selection for each inline action. */
const INLINE_MARKERS: Record<"bold" | "italic" | "code", string> = {
  bold: "**",
  italic: "*",
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
    case "code":
      return inlineWrap(text, selectionStart, selectionEnd, INLINE_MARKERS[action]);
    case "link":
      return applyLink(text, selectionStart, selectionEnd);
    case "heading":
      return linePrefix(text, selectionStart, selectionEnd, "# ");
    case "list":
      return linePrefix(text, selectionStart, selectionEnd, "- ");
    default: {
      // Exhaustiveness guard: FormatAction is a closed union, so this is unreachable at compile time.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
