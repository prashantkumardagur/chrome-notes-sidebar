<script lang="ts">
  import type { NoteMeta } from '../lib/storage/NotesRepository';

  let {
    notes,
    currentId,
    max,
    onSelect,
    onCreate,
    onRename,
    onDelete,
    onSearch,
    searchActive = false,
  }: {
    notes: NoteMeta[];
    currentId: string | null;
    max: number;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    onSearch: () => void;
    searchActive?: boolean;
  } = $props();

  let root: HTMLElement;
  let open = $state(false);
  let editing = $state(false);
  let draft = $state('');

  const currentTitle = $derived(notes.find((n) => n.id === currentId)?.title ?? '');
  const atCap = $derived(notes.length >= max);

  function toggleMenu() {
    if (editing) return;
    open = !open;
  }

  function pick(id: string) {
    open = false;
    // Always notify: selecting even the current note must leave search mode.
    // selectNote() dedupes the actual note reload when the id is unchanged.
    onSelect(id);
  }

  function create() {
    if (atCap) return;
    open = false;
    onCreate();
  }

  function startRename() {
    if (!currentId) return;
    open = false;
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

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    else if (e.key === 'Escape') cancelRename();
  }

  function confirmDelete() {
    if (!currentId) return;
    if (confirm(`Delete "${currentTitle}"? This can't be undone.`)) onDelete(currentId);
  }

  // Close the dropdown on an outside click or Escape.
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

<div class="selector" bind:this={root}>
  <div class="group">
    {#if editing}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="rename"
        bind:value={draft}
        onkeydown={onRenameKeydown}
        onblur={commitRename}
        autofocus
        aria-label="Rename note"
        maxlength="60"
      />
      <!-- preventDefault on mousedown keeps the input focused so onblur doesn't
           commit before these clicks resolve (esp. Cancel). -->
      <button
        type="button"
        class="icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={commitRename}
        title="Save name"
        aria-label="Save name"
      >
        ✓
      </button>
      <button
        type="button"
        class="icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={cancelRename}
        title="Cancel"
        aria-label="Cancel rename"
      >
        ✕
      </button>
    {:else}
      <button
        type="button"
        class="trigger"
        onclick={toggleMenu}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={currentTitle}
      >
        <span class="name">{currentTitle || 'Notes'}</span>
        <span class="caret" class:up={open} aria-hidden="true">▾</span>
      </button>
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
        title={notes.length <= 1 ? "Can't delete your only note" : 'Delete note'}
        aria-label="Delete note"
      >
        🗑
      </button>
      <button
        type="button"
        class="icon"
        class:active={searchActive}
        onclick={onSearch}
        aria-pressed={searchActive}
        title="Search notes"
        aria-label="Search notes"
      >
        🔍
      </button>
    {/if}
  </div>

  {#if open}
    <div class="menu" role="listbox" aria-label="Notes">
      <div class="list">
        {#each notes as note (note.id)}
          <button
            type="button"
            class="item"
            class:active={note.id === currentId}
            role="option"
            aria-selected={note.id === currentId}
            onclick={() => pick(note.id)}
            title={note.title}
          >
            {note.title}
          </button>
        {/each}
      </div>
      <div class="sep"></div>
      <div class="footer">
        <button
          type="button"
          class="new"
          onclick={create}
          disabled={atCap}
          title={atCap ? `Note limit reached (${max})` : 'Create a new note'}
        >
          <span aria-hidden="true">＋</span> New note
        </button>
        <span class="counter" class:full={atCap} title="Notes used out of the maximum">
          {notes.length}/{max}
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .selector {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .group {
    display: flex;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    min-width: 0;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 5px 8px;
    cursor: pointer;
    border-radius: 8px 0 0 8px;
  }

  .trigger .name {
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger .caret {
    color: var(--text-muted);
    font-size: 11px;
    transition: transform 0.12s ease;
  }

  .trigger .caret.up {
    transform: rotate(180deg);
  }

  .rename {
    flex: 1;
    min-width: 0;
    appearance: none;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 5px 8px;
  }

  .icon {
    appearance: none;
    border: none;
    border-left: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1;
    padding: 0 9px;
    cursor: pointer;
  }

  .icon:hover:not(:disabled) {
    background: var(--bg-subtle);
    color: var(--text);
  }

  /* Search toggle reads as pressed while search mode is on. */
  .icon.active {
    background: var(--bg-subtle);
    color: var(--accent);
  }

  .icon:last-child {
    border-radius: 0 8px 8px 0;
  }

  .icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .icon.danger:hover:not(:disabled) {
    color: #dc2626;
  }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 20;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    padding: 4px;
  }

  .list {
    max-height: 240px;
    overflow-y: auto;
  }

  .item {
    display: block;
    width: 100%;
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item:hover {
    background: var(--bg-subtle);
  }

  .item.active {
    color: var(--accent);
    font-weight: 600;
  }

  .sep {
    height: 1px;
    background: var(--border);
    margin: 4px 2px;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 4px 2px 2px;
  }

  .new {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
  }

  .new:hover:not(:disabled) {
    background: var(--bg-subtle);
  }

  .new:disabled {
    color: var(--text-muted);
    opacity: 0.6;
    cursor: not-allowed;
  }

  .counter {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    padding-right: 4px;
  }

  .counter.full {
    color: #dc2626;
  }
</style>
