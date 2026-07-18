<script lang="ts">
  import { onMount } from 'svelte';
  import type { Settings, ThemePref, ViewPref } from '../lib/settings/settings';

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

  function setTheme(theme: ThemePref) {
    if (theme !== settings.theme) onChange({ ...settings, theme });
  }

  function setView(view: ViewPref) {
    if (view !== settings.view) onChange({ ...settings, view });
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
