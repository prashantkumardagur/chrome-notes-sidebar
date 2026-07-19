<script lang="ts">
  import { tick } from 'svelte';
  import { applyFormat, type FormatAction } from '../lib/markdown/format';
  import { selectRangeInTextarea } from '../lib/search/highlight';

  let {
    value = $bindable(''),
    oninput,
    maxlength,
    select = null,
    wrap = true,
  }: {
    value: string;
    oninput?: () => void;
    maxlength?: number;
    // Set when a note is opened from a search result in Edit mode: the exact body
    // range to select + scroll into view. App clears it after so it can't re-fire.
    select?: { start: number; end: number } | null;
    // Word-wrap pref. Drives the textarea `wrap` attribute (copy semantics); the
    // visual wrapping comes from the --editor-white-space var set on the root.
    wrap?: boolean;
  } = $props();

  let textarea: HTMLTextAreaElement;

  $effect(() => {
    if (select && textarea) selectRangeInTextarea(textarea, select.start, select.end);
  });

  // Toolbar buttons + their shortcuts, in display order. `key` is the Cmd/Ctrl+<key>
  // shortcut for the action, or null for actions with no shortcut.
  const TOOLBAR_ACTIONS: { action: FormatAction; label: string; glyph: string; key: string | null }[] = [
    { action: 'bold', label: 'Bold', glyph: 'B', key: 'b' },
    { action: 'italic', label: 'Italic', glyph: 'I', key: 'i' },
    { action: 'link', label: 'Link', glyph: '🔗', key: 'k' },
    { action: 'code', label: 'Inline code', glyph: '</>', key: null },
    { action: 'heading', label: 'Heading', glyph: 'H', key: null },
    { action: 'list', label: 'Bulleted list', glyph: '•', key: null },
  ];

  function buttonTitle(a: (typeof TOOLBAR_ACTIONS)[number]): string {
    return a.key ? `${a.label} (Cmd/Ctrl+${a.key.toUpperCase()})` : a.label;
  }

  /** Apply a formatting action at the current selection, respecting the char cap. */
  async function run(action: FormatAction) {
    if (!textarea) return;
    const result = applyFormat(value, textarea.selectionStart, textarea.selectionEnd, action);
    // Programmatic `bind:value` writes bypass the textarea's `maxlength`, so the
    // toolbar/shortcuts would otherwise be a backdoor around the char cap — no-op instead.
    if (maxlength !== undefined && result.text.length > maxlength) return;

    value = result.text;
    oninput?.();
    // Wait for Svelte to flush `value` into the DOM before touching selection,
    // or setSelectionRange races the update and the caret lands wrong.
    await tick();
    selectRangeInTextarea(textarea, result.selectionStart, result.selectionEnd);
  }

  const SHORTCUT_ACTIONS: Record<string, FormatAction> = { b: 'bold', i: 'italic', k: 'link' };

  // Scoped to the textarea (not `window`) so it only fires while the editor has
  // focus and can't clash with the global Cmd/Ctrl+/ search shortcut in App.svelte.
  function onKeydown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const action = SHORTCUT_ACTIONS[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    void run(action);
  }
</script>

<div class="editor-surface">
  <div class="toolbar" role="toolbar" aria-label="Formatting">
    {#each TOOLBAR_ACTIONS as a (a.action)}
      <button
        type="button"
        class="fmt-btn"
        class:glyph-bold={a.action === 'bold'}
        class:glyph-italic={a.action === 'italic'}
        class:glyph-mono={a.action === 'code'}
        onmousedown={(e) => e.preventDefault()}
        onclick={() => run(a.action)}
        title={buttonTitle(a)}
        aria-label={a.label}
      >
        {a.glyph}
      </button>
    {/each}
  </div>
  <textarea
    class="editor"
    bind:this={textarea}
    bind:value
    {oninput}
    {maxlength}
    wrap={wrap ? 'soft' : 'off'}
    onkeydown={onKeydown}
    spellcheck="true"
    placeholder="Write your note in Markdown…"
    aria-label="Markdown editor"
  ></textarea>
</div>

<style>
  .editor-surface {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-subtle);
  }

  .fmt-btn {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    line-height: 1;
    padding: 5px 8px;
    cursor: pointer;
  }

  .fmt-btn:hover {
    background: var(--bg);
    color: var(--text);
  }

  .fmt-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .glyph-bold {
    font-weight: 700;
  }

  .glyph-italic {
    font-style: italic;
  }

  .glyph-mono {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  }

  .editor {
    flex: 1;
    min-height: 0;
    width: 100%;
    resize: none;
    border: none;
    outline: none;
    background: var(--bg);
    color: var(--text);
    padding: 12px 16px;
    /* Driven by the editor prefs (resolveEditorVars); fallbacks match the prior defaults. */
    font-family: var(--editor-font-family, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace);
    font-size: var(--editor-font-size, 13px);
    line-height: var(--content-line-height, 1.6);
    /* Word-wrap pref: pre-wrap wraps, pre scrolls long lines (overflow-x reveals them). */
    white-space: var(--editor-white-space, pre-wrap);
    overflow-x: auto;
    tab-size: 2;
  }
</style>
