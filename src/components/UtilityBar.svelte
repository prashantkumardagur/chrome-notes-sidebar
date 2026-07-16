<script lang="ts">
  import { relativeTime } from '../lib/util/time';

  let {
    body,
    updatedAt,
    charLimit,
    noteCount,
    maxNotes,
  }: {
    body: string;
    updatedAt: number | null;
    charLimit: number;
    noteCount: number;
    maxNotes: number;
  } = $props();

  let root: HTMLElement;
  let open = $state(false);
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const isEmpty = $derived(body.length === 0);

  async function copyAll() {
    if (isEmpty) return;
    try {
      await navigator.clipboard.writeText(body);
      copied = true;
      clearTimeout(copyTimer);
      // Revert the "Copied" affordance after a moment.
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch (err) {
      console.error('Failed to copy note:', err);
    }
  }

  function toggleInfo() {
    open = !open;
  }

  // Close the popover on an outside click or Escape (mirrors NoteSelector).
  $effect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open = false;
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeydown);
    };
  });

  $effect(() => () => clearTimeout(copyTimer));
</script>

<div class="tools" bind:this={root}>
  <button
    type="button"
    class="tool"
    class:copied
    onclick={copyAll}
    disabled={isEmpty}
    title={isEmpty ? 'Nothing to copy' : 'Copy all text'}
    aria-label="Copy all text"
  >
    {copied ? 'Copied' : 'Copy'}
  </button>

  <button
    type="button"
    class="tool icon"
    onclick={toggleInfo}
    aria-haspopup="dialog"
    aria-expanded={open}
    title="Note info"
    aria-label="Note info"
  >
    ⓘ
  </button>

  {#if open}
    <div class="popover" role="dialog" aria-label="Note info">
      <dl>
        <dt>Last edited</dt>
        <dd>{updatedAt ? relativeTime(updatedAt) : '—'}</dd>
        <dt>Characters</dt>
        <dd>{body.length}/{charLimit}</dd>
        <dt>Notes</dt>
        <dd>{noteCount}/{maxNotes}</dd>
      </dl>
    </div>
  {/if}
</div>

<style>
  .tools {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tool {
    appearance: none;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-muted);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
  }

  .tool:hover:not(:disabled) {
    background: var(--bg-subtle);
    color: var(--text);
  }

  .tool:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tool.copied {
    color: #16a34a;
    border-color: #16a34a;
  }

  .tool.icon {
    padding: 4px 7px;
    font-size: 13px;
  }

  .popover {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    z-index: 20;
    min-width: 180px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    padding: 8px 10px;
  }

  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 12px;
    margin: 0;
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    text-align: right;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
</style>
