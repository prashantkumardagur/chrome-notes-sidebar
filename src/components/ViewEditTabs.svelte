<script lang="ts">
  type Mode = 'edit' | 'view';
  let { mode = $bindable('edit') }: { mode: Mode } = $props();
</script>

<div class="tabs" role="tablist" aria-label="Editor mode">
  <button
    type="button"
    role="tab"
    aria-selected={mode === 'edit'}
    class:active={mode === 'edit'}
    onclick={() => (mode = 'edit')}
  >
    Edit
  </button>
  <button
    type="button"
    role="tab"
    aria-selected={mode === 'view'}
    class:active={mode === 'view'}
    onclick={() => (mode = 'view')}
  >
    View
  </button>
</div>

<style>
  .tabs {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  button {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 6px;
    cursor: pointer;
  }

  button.active {
    background: var(--bg);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
</style>
