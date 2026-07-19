/**
 * Toggle GFM task-list checkboxes in a Markdown source.
 *
 * View mode renders `- [ ]`/`- [x]` items as checkboxes; clicking the Nth one (in
 * document order) flips the Nth task marker in the source here. The mapping is reliable
 * because raw HTML renders as literal text (see docs/decisions.md), so every rendered
 * checkbox corresponds to exactly one source marker in the same order.
 */

// Line-anchored to mirror what `marked` treats as a task item: optional indentation, a
// bullet (`-`/`*`/`+`) or ordered (`1.`/`1)`) marker, whitespace, then `[ ]`/`[x]`/`[X]`.
// Anchoring to line start keeps a mid-text `[ ]` from being mistaken for a task marker.
const TASK_MARKER = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/gm;

/** Flip the Nth (0-based, document order) task-list marker in a Markdown source. */
export function toggleTaskAtIndex(source: string, index: number): string {
  if (index < 0) return source;
  let n = 0;
  return source.replace(TASK_MARKER, (match, prefix: string, state: string) => {
    // Only the marker at `index` flips; every other marker is returned verbatim so
    // indentation, bullet char, and trailing text stay byte-for-byte identical.
    if (n++ !== index) return match;
    const next = state === " " ? "x" : " ";
    return `${prefix}[${next}]`;
  });
}
