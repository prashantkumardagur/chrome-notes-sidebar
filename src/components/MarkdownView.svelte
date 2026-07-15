<script lang="ts">
  import { renderMarkdown } from '../lib/markdown/render';

  let { source = '' }: { source: string } = $props();
  const html = $derived(renderMarkdown(source));
</script>

<!-- `html` is sanitized by renderMarkdown (DOMPurify) before it reaches here. -->
<div class="view markdown-body">
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
</style>
