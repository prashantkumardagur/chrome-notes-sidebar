/**
 * Jump-to-match highlighting for a note opened from a search result.
 *
 * Two surfaces need two strategies (see docs/roadmap/highlighter.md):
 * - Edit mode is a `<textarea>`, which can only show one native selection, so we
 *   select the exact clicked occurrence by its known body offsets.
 * - View mode is sanitized, rendered Markdown, where a raw-body offset can't be
 *   trusted against the transformed HTML, so we highlight *every* rendered
 *   occurrence and scroll to the one nearest the click.
 *
 * View highlighting mutates existing text nodes only — it never builds an HTML
 * string and injects it — so it cannot reintroduce the XSS surface render.ts
 * guards. render.ts stays the sole HTML producer.
 */

/** Class on every `<mark>` this module adds, so we can find/remove them. */
const HIGHLIGHT_CLASS = "search-hit";
/** Extra class on the single occurrence nearest the click, styled to stand out. */
const ACTIVE_CLASS = "search-hit-active";

/** Edit mode: select the exact match range in the textarea and scroll it into view. */
export function selectRangeInTextarea(textarea: HTMLTextAreaElement, start: number, end: number): void {
  // Focusing first makes the native selection visible; setSelectionRange then
  // scrolls the selection into view for free across browsers.
  textarea.focus();
  textarea.setSelectionRange(start, end);
}

/** True if `node` is already inside a highlight `<mark>` we added (avoid double-wrapping). */
function isInsideHighlight(node: Node, container: HTMLElement): boolean {
  let el = node.parentElement;
  while (el && el !== container) {
    if (el.tagName === "MARK" && el.classList.contains(HIGHLIGHT_CLASS)) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * View mode: wrap every case-insensitive occurrence of `query` in `container`'s
 * text nodes with a highlight `<mark>`, then mark the occurrence nearest
 * `nearestIndex` (clamped into range) as active and scroll it into view. Returns
 * the number highlighted.
 *
 * Re-running is safe: nodes already inside a highlight are skipped, so a second
 * call doesn't double-wrap.
 */
export function highlightMatchesInView(container: HTMLElement, query: string, nearestIndex: number): number {
  const needle = query.toLowerCase();
  if (needle.length === 0) return 0;

  // Collect target text nodes first — splitting nodes while the TreeWalker is
  // live would make iteration unstable.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!isInsideHighlight(node, container)) textNodes.push(node as Text);
  }

  const marks: HTMLElement[] = [];
  for (const textNode of textNodes) {
    // Repeatedly split off each occurrence and wrap it, continuing in the tail.
    let workNode: Text = textNode;
    for (;;) {
      const at = workNode.data.toLowerCase().indexOf(needle);
      if (at === -1) break;
      // matchNode holds exactly the match; rest holds everything after it.
      const matchNode = workNode.splitText(at);
      const rest = matchNode.splitText(needle.length);
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_CLASS;
      matchNode.parentNode?.replaceChild(mark, matchNode);
      mark.appendChild(matchNode);
      marks.push(mark);
      workNode = rest;
    }
  }

  if (marks.length > 0) {
    const i = Math.min(Math.max(nearestIndex, 0), marks.length - 1);
    const target = marks[i];
    // Set the clicked occurrence apart from the rest (accent vs. muted fill).
    target.classList.add(ACTIVE_CLASS);
    // Guard: scrollIntoView isn't implemented in jsdom (unit tests).
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center" });
    }
  }
  return marks.length;
}

/** Remove any highlight `<mark>`s added by {@link highlightMatchesInView}, merging text back. */
export function clearViewHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    // Merge the now-adjacent text nodes back into one so the DOM matches its pre-highlight shape.
    parent.normalize();
  }
}
