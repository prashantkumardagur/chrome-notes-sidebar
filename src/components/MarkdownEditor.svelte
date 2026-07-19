<script lang="ts">
  import { tick } from 'svelte';
  import { applyFormat, continueList, indent, outdent, type FormatAction, type FormatResult } from '../lib/markdown/format';
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

  // Let the parent move focus into the editor — e.g. after committing a rename or
  // creating a note via the keyboard shortcut, so the user can start typing at once.
  export function focus() {
    textarea?.focus();
  }

  $effect(() => {
    if (select && textarea) selectRangeInTextarea(textarea, select.start, select.end);
  });

  type ToolbarButton = { action: FormatAction; label: string; glyph: string; key: string | null };

  // Toolbar buttons grouped into segments; a divider is rendered between groups.
  // `key` is the Cmd/Ctrl+<key> shortcut for the action, or null when it has none.
  const TOOLBAR_GROUPS: ToolbarButton[][] = [
    [{ action: 'heading', label: 'Heading', glyph: 'H', key: null }],
    [
      { action: 'bold', label: 'Bold', glyph: 'B', key: 'b' },
      { action: 'italic', label: 'Italic', glyph: 'I', key: 'i' },
      { action: 'strike', label: 'Strikethrough', glyph: 'S', key: null },
    ],
    [
      { action: 'link', label: 'Link', glyph: '🔗', key: 'k' },
      { action: 'code', label: 'Inline code', glyph: '</>', key: null },
      { action: 'codeblock', label: 'Code block', glyph: '{ }', key: null },
      { action: 'quote', label: 'Blockquote', glyph: '❝', key: null },
    ],
    [
      { action: 'list', label: 'Bulleted list', glyph: '', key: null },
      { action: 'orderedList', label: 'Numbered list', glyph: '', key: null },
      { action: 'checkList', label: 'Task list', glyph: '☑', key: null },
    ],
  ];

  function buttonTitle(a: ToolbarButton): string {
    return a.key ? `${a.label} (Cmd/Ctrl+${a.key.toUpperCase()})` : a.label;
  }

  /** Write a computed edit back into the textarea, respecting the char cap. */
  async function applyResult(result: FormatResult) {
    // Programmatic `bind:value` writes bypass the textarea's `maxlength`, so the
    // toolbar/shortcuts/Tab would otherwise be a backdoor around the char cap — no-op instead.
    if (maxlength !== undefined && result.text.length > maxlength) return;

    value = result.text;
    oninput?.();
    // Wait for Svelte to flush `value` into the DOM before touching selection,
    // or setSelectionRange races the update and the caret lands wrong.
    await tick();
    selectRangeInTextarea(textarea, result.selectionStart, result.selectionEnd);
  }

  /** Apply a formatting action at the current selection. */
  async function run(action: FormatAction) {
    if (!textarea) return;
    await applyResult(applyFormat(value, textarea.selectionStart, textarea.selectionEnd, action));
  }

  /** Apply a pure indent/outdent transform at the current selection. */
  async function runEdit(transform: (text: string, start: number, end: number) => FormatResult) {
    if (!textarea) return;
    await applyResult(transform(value, textarea.selectionStart, textarea.selectionEnd));
  }

  const SHORTCUT_ACTIONS: Record<string, FormatAction> = { b: 'bold', i: 'italic', k: 'link' };

  // Scoped to the textarea (not `window`) so it only fires while the editor has
  // focus and can't clash with the global Cmd/Ctrl+/ search shortcut in App.svelte.
  function onKeydown(e: KeyboardEvent) {
    // Tab indents (Shift+Tab outdents) instead of moving focus out of the editor —
    // notes are code-like, so an in-place 2-space indent beats losing the caret.
    if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      void runEdit(e.shiftKey ? outdent : indent);
      return;
    }
    // Enter inside a list/quote line carries the marker to the next line (backspace
    // to break out); a plain Enter elsewhere falls through to the browser default.
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const result = continueList(value, textarea.selectionStart, textarea.selectionEnd);
      if (result) {
        e.preventDefault();
        void applyResult(result);
      }
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const action = SHORTCUT_ACTIONS[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    void run(action);
  }
</script>

<div class="editor-surface">
  <div class="toolbar" role="toolbar" aria-label="Formatting">
    {#each TOOLBAR_GROUPS as group, i (i)}
      {#if i > 0}
        <span class="divider" role="separator" aria-orientation="vertical"></span>
      {/if}
      {#each group as a (a.action)}
        <button
          type="button"
          class="fmt-btn"
          class:glyph-bold={a.action === 'bold'}
          class:glyph-italic={a.action === 'italic'}
          class:glyph-strike={a.action === 'strike'}
          class:glyph-mono={a.action === 'code' || a.action === 'codeblock'}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => run(a.action)}
          title={buttonTitle(a)}
          aria-label={a.label}
        >
          <!-- The two list buttons use line-icons (bullets/numbers + lines); every
               other button is a text glyph. -->
          {#if a.action === 'list'}
            <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="2.5" cy="4" r="1.3" fill="currentColor" />
              <circle cx="2.5" cy="8" r="1.3" fill="currentColor" />
              <circle cx="2.5" cy="12" r="1.3" fill="currentColor" />
              <path
                d="M6 4h8M6 8h8M6 12h8"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          {:else if a.action === 'orderedList'}
            <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6.5 4h7.5M6.5 8h7.5M6.5 12h7.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <text x="0.5" y="5.7" font-size="5.5" font-weight="600" fill="currentColor">1</text>
              <text x="0.5" y="9.7" font-size="5.5" font-weight="600" fill="currentColor">2</text>
              <text x="0.5" y="13.7" font-size="5.5" font-weight="600" fill="currentColor">3</text>
            </svg>
          {:else}
            {a.glyph}
          {/if}
        </button>
      {/each}
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
    gap: 1px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-subtle);
    /* Eleven buttons can outgrow a narrow side panel; scroll rather than wrap/clip. */
    overflow-x: auto;
    scrollbar-width: none;
  }

  .toolbar::-webkit-scrollbar {
    display: none;
  }

  .divider {
    flex: none;
    align-self: stretch;
    width: 1px;
    margin: 3px 4px;
    background: var(--border);
  }

  .fmt-btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    appearance: none;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    line-height: 1;
    min-width: 26px;
    height: 24px;
    padding: 0 6px;
    cursor: pointer;
  }

  .fmt-btn .icon {
    width: 15px;
    height: 15px;
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

  .glyph-strike {
    text-decoration: line-through;
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
