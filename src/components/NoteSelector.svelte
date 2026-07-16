<script lang="ts">
  import type { NoteMeta } from "../lib/storage/NotesRepository";

  let {
    notes,
    currentId,
    max,
    onSelect,
    onCreate,
    onRename,
    onDelete,
  }: {
    notes: NoteMeta[];
    currentId: string | null;
    max: number;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
  } = $props();

  let editing = $state(false);
  let draft = $state("");

  const currentTitle = $derived(notes.find((n) => n.id === currentId)?.title ?? "");
  const atCap = $derived(notes.length >= max);

  function startRename() {
    if (!currentId) return;
    draft = currentTitle;
    editing = true;
  }

  function commitRename() {
    if (currentId) onRename(currentId, draft);
    editing = false;
  }

  function cancelRename() {
    editing = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    else if (e.key === "Escape") cancelRename();
  }

  function confirmDelete() {
    if (!currentId) return;
    if (confirm(`Delete "${currentTitle}"? This can't be undone.`)) onDelete(currentId);
  }
</script>

<div class="selector">
  {#if editing}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="rename"
      bind:value={draft}
      onkeydown={onKeydown}
      onblur={commitRename}
      autofocus
      aria-label="Rename note"
      maxlength="60"
    />
    <button type="button" class="icon" onclick={commitRename} title="Save name" aria-label="Save name">
      ✓
    </button>
    <button type="button" class="icon" onclick={cancelRename} title="Cancel" aria-label="Cancel rename">
      ✕
    </button>
  {:else}
    <select
      class="notes"
      value={currentId}
      onchange={(e) => onSelect((e.currentTarget as HTMLSelectElement).value)}
      aria-label="Select note"
    >
      {#each notes as note (note.id)}
        <option value={note.id}>{note.title}</option>
      {/each}
    </select>

    <button
      type="button"
      class="icon"
      onclick={startRename}
      disabled={!currentId}
      title="Rename note"
      aria-label="Rename note"
    >
      ✎
    </button>
    <button
      type="button"
      class="icon danger"
      onclick={confirmDelete}
      disabled={!currentId || notes.length <= 1}
      title={notes.length <= 1 ? "Can't delete your only note" : "Delete note"}
      aria-label="Delete note"
    >
      🗑
    </button>

    <span class="count" title="Notes used out of the maximum">{notes.length}/{max}</span>
    <button
      type="button"
      class="icon new"
      onclick={onCreate}
      disabled={atCap}
      title={atCap ? `Note limit reached (${max})` : "New note"}
      aria-label="New note"
    >
      ＋
    </button>
  {/if}
</div>

<style>
  .selector {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .notes,
  .rename {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 6px;
  }

  .rename {
    outline: none;
  }

  .icon {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 6px;
    cursor: pointer;
  }

  .icon:hover:not(:disabled) {
    background: var(--bg-subtle);
    color: var(--text);
  }

  .icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .icon.danger:hover:not(:disabled) {
    color: #dc2626;
  }

  .count {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    padding: 0 2px;
  }
</style>
