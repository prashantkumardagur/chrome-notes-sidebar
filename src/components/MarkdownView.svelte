<script lang="ts">
  import { renderMarkdown } from '../lib/markdown/render';
  import { clearViewHighlights, highlightMatchesInView } from '../lib/search/highlight';

  let {
    source = '',
    highlight = null,
    onDismissHighlight,
    onToggleTask,
  }: {
    source: string;
    // Set when a note is opened from a search result in View mode: highlight every
    // occurrence of `query` and scroll to the one nearest the clicked occurrence.
    highlight?: { query: string; nearestIndex: number } | null;
    onDismissHighlight?: () => void;
    // Clicking the Nth (document-order) task-list checkbox reports its index so App
    // can flip the matching source marker and autosave.
    onToggleTask?: (index: number) => void;
  } = $props();
  const html = $derived(renderMarkdown(source));

  let viewEl: HTMLDivElement;

  // Runs after `html` is in the DOM (reading `html` makes it a dependency), so the
  // marks are applied to freshly rendered content. A source change reassigns
  // innerHTML, which wipes old marks — no manual clear needed on note switch.
  $effect(() => {
    html;
    if (highlight && viewEl) highlightMatchesInView(viewEl, highlight.query, highlight.nearestIndex);
  });

  // Make genuine task-list checkboxes clickable. Reruns on every `html` change so the
  // listeners always match the freshly reassigned innerHTML (old nodes/listeners are
  // discarded with the previous DOM). Scoped to the two shapes `marked` emits for a task
  // item: `li > input` (tight list) and `li > p > input` (loose list — produced when a
  // blank line separates items). querySelectorAll returns document order, so the index
  // still lines up with the source task markers the toggle walks.
  $effect(() => {
    html;
    if (!viewEl || !onToggleTask) return;
    const boxes = viewEl.querySelectorAll<HTMLInputElement>(
      'li > input[type="checkbox"], li > p > input[type="checkbox"]',
    );
    boxes.forEach((box, index) => {
      box.removeAttribute('disabled');
      // Listen on `click` (not `change`) so stopPropagation keeps the same click from
      // bubbling to the container's dismiss() and clearing search highlights — the
      // container's own handler is `onclick`. The box's visual state is overwritten by
      // the re-render from the source change anyway.
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        onToggleTask(index);
      });
    });
  });

  // Any click in the note dismisses the highlights and tells App to drop the
  // pending highlight so the effect doesn't re-apply them.
  function dismiss() {
    if (viewEl) clearViewHighlights(viewEl);
    onDismissHighlight?.();
  }
</script>

<!-- `html` is sanitized by renderMarkdown (DOMPurify) before it reaches here. -->
<!-- Dismiss-on-click is a pointer convenience over already-accessible content; keyboard
     users clear highlights by switching notes or toggling Edit/View. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="view markdown-body" bind:this={viewEl} onclick={dismiss}>
  {#if source.trim().length === 0}
    <p class="empty">Nothing to preview yet. Switch to <strong>Edit</strong> to start writing.</p>
  {:else}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html html}
  {/if}
</div>

<style>
  .view {
    height: 100%;
    overflow-y: auto;
    padding: 12px 16px;
    font-size: 14px;
  }

  .empty {
    color: var(--text-muted);
  }

  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3) {
    line-height: 1.25;
    margin: 0.8em 0 0.4em;
  }

  .markdown-body :global(h1) {
    font-size: 1.5em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.2em;
  }

  .markdown-body :global(h2) {
    font-size: 1.25em;
  }

  .markdown-body :global(a) {
    color: var(--accent);
  }

  .markdown-body :global(code) {
    background: var(--code-bg);
    padding: 0.15em 0.35em;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .markdown-body :global(pre) {
    background: var(--code-bg);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
  }

  .markdown-body :global(pre code) {
    background: none;
    padding: 0;
  }

  /* Syntax-highlight token colors for fenced code blocks with an explicit, supported
     language (see src/lib/markdown/render.ts). Mapped to --hl-* vars (not a prebuilt hljs
     theme) so every language themes at once and flips with light/dark. */
  .markdown-body :global(.hljs-keyword) {
    color: var(--hl-keyword);
  }

  .markdown-body :global(.hljs-string) {
    color: var(--hl-string);
  }

  .markdown-body :global(.hljs-comment) {
    color: var(--hl-comment);
    font-style: italic;
  }

  .markdown-body :global(.hljs-number) {
    color: var(--hl-number);
  }

  .markdown-body :global(.hljs-function) {
    color: var(--hl-function);
  }

  .markdown-body :global(.hljs-title) {
    color: var(--hl-title);
  }

  .markdown-body :global(.hljs-attr),
  .markdown-body :global(.hljs-attribute),
  .markdown-body :global(.hljs-name),
  .markdown-body :global(.hljs-variable) {
    color: var(--hl-attr);
  }

  .markdown-body :global(.hljs-built_in) {
    color: var(--hl-built-in);
  }

  .markdown-body :global(.hljs-literal),
  .markdown-body :global(.hljs-bullet) {
    color: var(--hl-literal);
  }

  /* Extra token classes seen across the curated set (xml tag names, css/markdown
     selectors & headings, markdown links) — reuse the same vars above rather than
     adding more, so this stays one small map. */
  .markdown-body :global(.hljs-selector-class),
  .markdown-body :global(.hljs-selector-id),
  .markdown-body :global(.hljs-selector-tag),
  .markdown-body :global(.hljs-section) {
    color: var(--hl-title);
  }

  .markdown-body :global(.hljs-link) {
    color: var(--hl-string);
  }

  .markdown-body :global(.hljs-meta) {
    color: var(--hl-comment);
  }

  .markdown-body :global(blockquote) {
    margin: 0.6em 0;
    padding-left: 12px;
    border-left: 3px solid var(--border);
    color: var(--text-muted);
  }

  .markdown-body :global(table) {
    border-collapse: collapse;
    width: 100%;
  }

  .markdown-body :global(th),
  .markdown-body :global(td) {
    border: 1px solid var(--border);
    padding: 4px 8px;
    text-align: left;
  }

  .markdown-body :global(img) {
    max-width: 100%;
  }

  /* Task-list items read as a checkbox + text with no bullet marker (GitHub-style) —
     the checkbox is the marker. Covers both the tight (li > input) and loose
     (li > p > input, when a blank line separates items) shapes marked emits. */
  .markdown-body :global(li:has(> input[type="checkbox"])),
  .markdown-body :global(li:has(> p > input[type="checkbox"])) {
    list-style: none;
  }

  .markdown-body :global(li > input[type="checkbox"]),
  .markdown-body :global(li > p > input[type="checkbox"]) {
    margin: 0 0.4em 0 0;
    vertical-align: middle;
  }

  /* A blank line makes a list "loose", wrapping each item's text in a <p> with block
     margins — which would space task groups apart unevenly. Collapse that margin so a
     blank-line-separated task list reads like a single tight checklist. */
  .markdown-body :global(li:has(> p > input[type="checkbox"]) > p) {
    margin: 0;
  }

  /* Jump-to-match highlights from a search result. Other occurrences get a muted
     grey fill; the clicked occurrence keeps the accent so it stands out. The page
     bg as text keeps both legible in light and dark themes. */
  .markdown-body :global(mark.search-hit) {
    background: var(--text-muted);
    color: var(--bg);
    border-radius: 2px;
    padding: 0 1px;
  }

  .markdown-body :global(mark.search-hit-active) {
    background: var(--accent);
  }
</style>
