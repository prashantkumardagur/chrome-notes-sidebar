<script lang="ts">
  import { onMount } from 'svelte';
  import {
    DEFAULT_EDITOR_FONT,
    DEFAULT_FONT_SIZE,
    DEFAULT_LINE_SPACING,
    DEFAULT_WORD_WRAP,
    type EditorFont,
    type FontSize,
    type LineSpacing,
    type Settings,
    type ThemePref,
    type ViewPref,
  } from '../lib/settings/settings';

  let {
    settings,
    onChange,
    onExport,
    onImport,
    onClose,
  }: {
    settings: Settings;
    onChange: (next: Settings) => void;
    onExport: () => Promise<{ filename: string; content: string }>;
    onImport: (raw: string) => Promise<number>;
    onClose: () => void;
  } = $props();

  let closeButton: HTMLButtonElement = $state()!;
  let fileInput: HTMLInputElement = $state()!;
  let importMessage = $state<string | null>(null);

  const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  const VIEW_OPTIONS: { value: ViewPref; label: string }[] = [
    { value: 'persistent', label: 'Remember' },
    { value: 'edit', label: 'Edit' },
    { value: 'view', label: 'View' },
  ];
  const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
  ];
  const LINE_SPACING_OPTIONS: { value: LineSpacing; label: string }[] = [
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'compact', label: 'Compact' },
  ];
  const EDITOR_FONT_OPTIONS: { value: EditorFont; label: string }[] = [
    { value: 'mono', label: 'Mono' },
    { value: 'sans', label: 'Sans' },
  ];
  const WORD_WRAP_OPTIONS: { value: boolean; label: string }[] = [
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ];

  // Current effective value for each editor pref (settings omit fields at their default).
  const fontSize = $derived(settings.fontSize ?? DEFAULT_FONT_SIZE);
  const lineSpacing = $derived(settings.lineSpacing ?? DEFAULT_LINE_SPACING);
  const editorFont = $derived(settings.editorFont ?? DEFAULT_EDITOR_FONT);
  const wordWrap = $derived(settings.wordWrap ?? DEFAULT_WORD_WRAP);

  function setTheme(theme: ThemePref) {
    if (theme !== settings.theme) onChange({ ...settings, theme });
  }

  function setView(view: ViewPref) {
    if (view !== settings.view) onChange({ ...settings, view });
  }

  // Editor prefs: drop the key when at its default (like lastNoteId) so stored
  // settings stay clean; otherwise set it. No-op when the value is unchanged.
  function setFontSize(value: FontSize) {
    if (value === fontSize) return;
    const next = { ...settings };
    if (value === DEFAULT_FONT_SIZE) delete next.fontSize;
    else next.fontSize = value;
    onChange(next);
  }

  function setLineSpacing(value: LineSpacing) {
    if (value === lineSpacing) return;
    const next = { ...settings };
    if (value === DEFAULT_LINE_SPACING) delete next.lineSpacing;
    else next.lineSpacing = value;
    onChange(next);
  }

  function setEditorFont(value: EditorFont) {
    if (value === editorFont) return;
    const next = { ...settings };
    if (value === DEFAULT_EDITOR_FONT) delete next.editorFont;
    else next.editorFont = value;
    onChange(next);
  }

  function setWordWrap(value: boolean) {
    if (value === wordWrap) return;
    const next = { ...settings };
    if (value === DEFAULT_WORD_WRAP) delete next.wordWrap;
    else next.wordWrap = value;
    onChange(next);
  }

  async function handleExport() {
    importMessage = null;
    try {
      const { filename, content } = await onExport();
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
      importMessage = err instanceof Error ? err.message : 'Export failed.';
    }
  }

  function triggerImport() {
    importMessage = null;
    fileInput.click();
  }

  async function handleFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;

    if (!confirm('Importing will replace all existing notes and settings. Continue?')) return;

    try {
      const skipped = await onImport(await file.text());
      importMessage = skipped > 0 ? `Imported — ${skipped} note(s) skipped as invalid.` : 'Import complete.';
    } catch (err) {
      console.error('Failed to import backup:', err);
      importMessage = err instanceof Error ? err.message : 'Import failed.';
    }
  }

  onMount(() => {
    // Move focus into the page on open (mirrors SearchPanel focusing its input),
    // so keyboard users land somewhere useful instead of on the editor that just unmounted.
    closeButton?.focus();
  });

  // Escape closes the page regardless of which control inside it has focus (unlike
  // SearchPanel's single input, focus here can land on any of several buttons), so the
  // listener is document-level and lives only while this page is mounted.
  $effect(() => {
    const onDocumentKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onDocumentKeydown);
    return () => document.removeEventListener('keydown', onDocumentKeydown);
  });
</script>

<div class="settings-page">
  <div class="header">
    <h2 class="title">Settings</h2>
    <button
      type="button"
      class="close"
      bind:this={closeButton}
      onclick={onClose}
      title="Close settings"
      aria-label="Close settings"
    >
      ✕
    </button>
  </div>

  <div class="body">
    <fieldset>
      <legend>Theme</legend>
      <div class="segmented">
        {#each THEME_OPTIONS as opt (opt.value)}
          <button
            type="button"
            class:active={settings.theme === opt.value}
            aria-pressed={settings.theme === opt.value}
            onclick={() => setTheme(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>View on note switch</legend>
      <div class="segmented">
        {#each VIEW_OPTIONS as opt (opt.value)}
          <button
            type="button"
            class:active={settings.view === opt.value}
            aria-pressed={settings.view === opt.value}
            onclick={() => setView(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Font size</legend>
      <div class="segmented">
        {#each FONT_SIZE_OPTIONS as opt (opt.value)}
          <button
            type="button"
            class:active={fontSize === opt.value}
            aria-pressed={fontSize === opt.value}
            onclick={() => setFontSize(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Line spacing</legend>
      <div class="segmented">
        {#each LINE_SPACING_OPTIONS as opt (opt.value)}
          <button
            type="button"
            class:active={lineSpacing === opt.value}
            aria-pressed={lineSpacing === opt.value}
            onclick={() => setLineSpacing(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Editor font</legend>
      <div class="segmented">
        {#each EDITOR_FONT_OPTIONS as opt (opt.value)}
          <button
            type="button"
            class:active={editorFont === opt.value}
            aria-pressed={editorFont === opt.value}
            onclick={() => setEditorFont(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Word wrap</legend>
      <div class="segmented">
        {#each WORD_WRAP_OPTIONS as opt (opt.value)}
          <button
            type="button"
            class:active={wordWrap === opt.value}
            aria-pressed={wordWrap === opt.value}
            onclick={() => setWordWrap(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Backup</legend>
      <div class="backup-actions">
        <button type="button" onclick={handleExport}>Export</button>
        <button type="button" onclick={triggerImport}>Import</button>
      </div>
      {#if importMessage}
        <p class="backup-message" role="status" aria-live="polite">{importMessage}</p>
      {/if}
      <input
        bind:this={fileInput}
        type="file"
        accept="application/json,.json"
        class="visually-hidden"
        onchange={handleFileSelected}
      />
    </fieldset>
  </div>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-subtle);
  }

  .title {
    margin: 0;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
  }

  .close {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1;
    padding: 4px 6px;
    cursor: pointer;
    border-radius: 4px;
  }

  .close:hover {
    background: var(--bg);
    color: var(--text);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
    color: var(--text-muted);
    font-size: 11px;
  }

  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .segmented button {
    appearance: none;
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
  }

  .segmented button.active {
    background: var(--bg);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .backup-actions {
    display: flex;
    gap: 6px;
  }

  .backup-actions button {
    appearance: none;
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 8px;
    cursor: pointer;
  }

  .backup-actions button:hover {
    background: var(--bg-subtle);
  }

  .backup-message {
    margin: 6px 0 0;
    color: var(--text-muted);
    font-size: 11px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
