<script lang="ts">
  import { renderMarkdown } from '../lib/markdown/render';
  import { clearViewHighlights, highlightMatchesInView } from '../lib/search/highlight';

  let {
    source = '',
    highlight = null,
    onDismissHighlight,
  }: {
    source: string;
    // Set when a note is opened from a search result in View mode: highlight every
    // occurrence of `query` and scroll to the one nearest the clicked occurrence.
    highlight?: { query: string; nearestIndex: number } | null;
    onDismissHighlight?: () => void;
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

  /* Jump-to-match highlight from a search result. Accent fill with the page bg as
     text keeps it legible in both light and dark themes. */
  .markdown-body :global(mark.search-hit) {
    background: var(--accent);
    color: var(--bg);
    border-radius: 2px;
    padding: 0 1px;
  }
</style>
