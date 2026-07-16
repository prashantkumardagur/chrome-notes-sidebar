<script lang="ts">
  import type { Settings, ThemePref, ViewPref } from '../lib/settings/settings';

  let {
    settings,
    onChange,
  }: {
    settings: Settings;
    onChange: (next: Settings) => void;
  } = $props();

  let root: HTMLElement;
  let open = $state(false);

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

  // Close the popover on an outside click or Escape (mirrors UtilityBar).
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
</script>

<div class="settings" bind:this={root}>
  <button
    type="button"
    class="tool"
    onclick={() => (open = !open)}
    aria-haspopup="dialog"
    aria-expanded={open}
    title="Settings"
    aria-label="Settings"
  >
    <span class="glyph" aria-hidden="true">⚙</span>
  </button>

  {#if open}
    <div class="popover" role="dialog" aria-label="Settings">
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
    </div>
  {/if}
</div>

<style>
  .settings {
    position: relative;
    display: inline-flex;
  }

  /* Standalone button, styled to match UtilityBar's tools but not part of its group.
     The gear glyph renders small and low on the baseline, so bump its size and
     center it with flex; the trimmed vertical padding keeps the box height equal
     to the neighbouring copy/info buttons. */
  .tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    appearance: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text-muted);
    font: inherit;
    font-size: 15px;
    line-height: 1;
    padding: 4px 9px;
    cursor: pointer;
  }

  /* The gear glyph's visual center sits below its font box; nudge it up so it
     reads as vertically centered within the button. */
  .glyph {
    display: block;
    transform: translateY(-1px);
  }

  .tool:hover {
    background: var(--bg-subtle);
    color: var(--text);
  }

  .popover {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    z-index: 20;
    min-width: 200px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
  }

  .segmented button.active {
    background: var(--bg);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
</style>
