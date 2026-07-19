<script lang="ts">
  import { TOGGLE_PANEL_COMMAND } from '../lib/commands/panelToggle';
  import { lineCount, wordCount } from '../lib/notes/stats';
  import { buildShortcutRows } from '../lib/shortcuts/shortcuts';
  import { relativeTime } from '../lib/util/time';

  let {
    body,
    version,
    updatedAt,
    charLimit,
    noteCount,
    maxNotes,
    open,
    onOpenChange,
  }: {
    body: string;
    version: string;
    updatedAt: number | null;
    charLimit: number;
    noteCount: number;
    maxNotes: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } = $props();

  let root: HTMLElement;
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const isEmpty = $derived(body.length === 0);
  const words = $derived(wordCount(body));
  const lines = $derived(lineCount(body));

  // ⌘ on macOS, Ctrl elsewhere — detected once per component instance (platform doesn't change mid-session).
  const mac = /Mac/i.test(navigator.platform);

  // Live `open-panel` binding, re-read each time the popover opens so a rebind at
  // chrome://extensions/shortcuts shows up without reloading the panel. Defaults to
  // null (→ the platform default label) in tests/non-extension contexts or on error.
  let toggleKey = $state<string | null>(null);
  const shortcutRows = $derived(buildShortcutRows({ mac, toggleKey }));

  async function fetchToggleKey() {
    if (typeof chrome === 'undefined' || !chrome.commands?.getAll) {
      toggleKey = null;
      return;
    }
    try {
      const commands = await chrome.commands.getAll();
      toggleKey = commands.find((c) => c.name === TOGGLE_PANEL_COMMAND)?.shortcut || null;
    } catch (err) {
      console.error('Failed to read the toggle-panel shortcut:', err);
      toggleKey = null;
    }
  }

  $effect(() => {
    if (open) fetchToggleKey();
  });

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
    onOpenChange(!open);
  }

  // Close the popover on an outside click or Escape (mirrors NoteSelector).
  $effect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) onOpenChange(false);
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
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
  <div class="group">
    <button
      type="button"
      class="tool"
      class:copied
      onclick={copyAll}
      disabled={isEmpty}
      title={isEmpty ? 'Nothing to copy' : 'Copy all text'}
      aria-label="Copy all text"
    >
      {copied ? '✓' : '⧉'}
    </button>
    <button
      type="button"
      class="tool"
      onclick={toggleInfo}
      aria-haspopup="dialog"
      aria-expanded={open}
      title="Note info"
      aria-label="Note info"
    >
      ⓘ
    </button>
  </div>

  {#if open}
    <div class="popover" role="dialog" aria-label="Note info">
      <dl>
        <dt>Last edited</dt>
        <dd>{updatedAt ? relativeTime(updatedAt) : '—'}</dd>
        <dt>Characters</dt>
        <dd>{body.length}/{charLimit}</dd>
        <dt>Words</dt>
        <dd>{words}</dd>
        <dt>Lines</dt>
        <dd>{lines}</dd>
        <dt>Notes</dt>
        <dd>{noteCount}/{maxNotes}</dd>
        <dt>Version</dt>
        <dd>{version}</dd>
      </dl>

      <details class="shortcuts">
        <summary>Keyboard shortcuts</summary>
        <ul>
          {#each shortcutRows as row (row.action)}
            <li>
              <kbd>{row.keys}</kbd>
              <span>{row.action}</span>
            </li>
          {/each}
        </ul>
      </details>
    </div>
  {/if}
</div>

<style>
  .tools {
    position: relative;
    display: inline-flex;
  }

  .group {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
  }

  .tool {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 13px;
    line-height: 1;
    padding: 5px 9px;
    cursor: pointer;
  }

  /* Connect the buttons into one group with a shared divider between them. */
  .tool + .tool {
    border-left: 1px solid var(--border);
  }

  .tool:first-child {
    border-radius: 8px 0 0 8px;
  }

  .tool:last-child {
    border-radius: 0 8px 8px 0;
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
    /* The popover opens upward; with a collapsible section expanded it can grow
       taller than the panel, so cap it and scroll internally instead of clipping
       off the top of the viewport. */
    max-height: min(70vh, 320px);
    overflow-y: auto;
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

  .shortcuts {
    margin-top: 8px;
    border-top: 1px solid var(--border);
    padding-top: 6px;
  }

  .shortcuts summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 12px;
  }

  .shortcuts ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .shortcuts li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .shortcuts li span {
    color: var(--text-muted);
    font-size: 12px;
  }

  .shortcuts kbd {
    font-family: inherit;
    font-size: 11px;
    color: var(--text);
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 6px;
    white-space: nowrap;
  }
</style>
