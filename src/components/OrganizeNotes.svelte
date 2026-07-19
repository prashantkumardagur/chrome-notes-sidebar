<script lang="ts">
  import { untrack } from 'svelte';
  import type { SortMode } from '../lib/settings/settings';
  import type { NoteMeta } from '../lib/storage/NotesRepository';

  let {
    notes,
    sortMode,
    onSortModeChange,
    onReorder,
    onClose,
  }: {
    // Already in display order (App keeps `notes:index` sorted for auto modes).
    notes: NoteMeta[];
    sortMode: SortMode;
    onSortModeChange: (mode: SortMode) => void;
    onReorder: (ids: string[]) => void;
    onClose: () => void;
  } = $props();

  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'title', label: 'Title (A–Z)' },
    { value: 'updated', label: 'Last edited' },
  ];

  // Reorder is only allowed in manual mode; auto modes derive the order from a field.
  const isManual = $derived(sortMode === 'manual');

  // Roving-tabindex + highlight target. `focusedId` is the row the user last landed on;
  // `currentId` falls back to the first row so there's always a highlighted, keyboard-
  // ready row in manual mode (no click required).
  let focusedId = $state<string | null>(null);
  const currentId = $derived<string | null>(focusedId ?? notes[0]?.id ?? null);
  // Set before a reorder so an effect re-focuses the moved row once the (async) parent
  // update lands — Svelte's keyed reconcile doesn't reliably preserve DOM focus on a move.
  let pendingRefocus = $state(false);
  // The row currently being dragged, and the row a drag is hovering over (for the
  // drop indicator). Both cleared on dragend/drop.
  let dragId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);

  const rowEls = new Map<string, HTMLElement>();

  // Register each row element by id so keyboard navigation can move focus between rows.
  function register(el: HTMLElement, id: string) {
    rowEls.set(id, el);
    return { destroy: () => rowEls.delete(id) };
  }

  function focusRow(id: string | null) {
    if (id) rowEls.get(id)?.focus();
  }

  function activeIsRow(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLElement && [...rowEls.values()].includes(active);
  }

  function activeInSortbar(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.closest('.sortbar') !== null;
  }

  // In manual mode, make sure a row holds focus so the arrow keys work without a click.
  // Runs on open and when switching back to manual — but never yanks focus away from the
  // sort selector the user is operating.
  $effect(() => {
    if (!isManual) return;
    untrack(() => {
      if (!activeIsRow() && !activeInSortbar()) focusRow(currentId);
    });
  });

  // After a reorder the note list (order) changes; re-focus the moved row so repeated
  // Shift+Arrow presses keep working (both directions) and the drag target stays focused.
  $effect(() => {
    // Track the order so this re-runs whenever the list is reordered.
    void notes.map((n) => n.id).join('\n');
    untrack(() => {
      if (!pendingRefocus) return;
      pendingRefocus = false;
      focusRow(focusedId);
    });
  });

  function ids(): string[] {
    return notes.map((n) => n.id);
  }

  function moveInList(list: string[], from: number, to: number): string[] {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  function selectMode(mode: SortMode) {
    if (mode !== sortMode) onSortModeChange(mode);
  }

  function onModeKeydown(e: KeyboardEvent, index: number) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    const next = (index + dir + SORT_OPTIONS.length) % SORT_OPTIONS.length;
    selectMode(SORT_OPTIONS[next].value);
  }

  function onRowKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (!isManual) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const list = ids();
    const dir = e.key === 'ArrowUp' ? -1 : 1;
    const to = index + dir;
    if (to < 0 || to >= list.length) return;
    if (e.shiftKey) {
      // Move the focused note one slot; re-focus it once the reorder lands.
      focusedId = list[index];
      pendingRefocus = true;
      onReorder(moveInList(list, index, to));
    } else {
      // Move focus only.
      const targetId = list[to];
      focusedId = targetId;
      focusRow(targetId);
    }
  }

  function onDragStart(e: DragEvent, id: string) {
    if (!isManual) return;
    dragId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // A payload is required for a drag to start in some browsers.
      e.dataTransfer.setData('text/plain', id);
    }
  }

  function onDragOver(e: DragEvent, id: string) {
    if (!isManual || dragId === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverId = id;
  }

  function onDrop(e: DragEvent, targetId: string) {
    if (!isManual || dragId === null) return;
    e.preventDefault();
    const list = ids();
    const from = list.indexOf(dragId);
    const to = list.indexOf(targetId);
    dragId = null;
    dragOverId = null;
    if (from === -1 || to === -1 || from === to) return;
    focusedId = list[from]; // the dragged note keeps the highlight after the drop
    pendingRefocus = true;
    onReorder(moveInList(list, from, to));
  }

  function onDragEnd() {
    dragId = null;
    dragOverId = null;
  }
</script>

<div class="organize">
  <div class="bar">
    <span class="title">Organize notes</span>
    <button type="button" class="close" onclick={onClose} title="Close" aria-label="Close organize notes">
      ✕
    </button>
  </div>

  <div class="sortbar" role="radiogroup" aria-label="Sort notes by">
    {#each SORT_OPTIONS as option, i (option.value)}
      <button
        type="button"
        class="seg"
        class:active={sortMode === option.value}
        role="radio"
        aria-checked={sortMode === option.value}
        tabindex={sortMode === option.value ? 0 : -1}
        onclick={() => selectMode(option.value)}
        onkeydown={(e) => onModeKeydown(e, i)}
      >
        {option.label}
      </button>
    {/each}
  </div>

  <div class="list" role="listbox" aria-label="Notes order">
    {#each notes as note, i (note.id)}
      <div
        class="row"
        class:locked={!isManual}
        class:current={isManual && note.id === currentId}
        class:dragging={dragId === note.id}
        class:dragover={dragOverId === note.id && dragId !== note.id}
        role="option"
        aria-selected={note.id === currentId}
        tabindex={note.id === currentId ? 0 : -1}
        aria-label={`${note.title || 'Untitled'}, ${i + 1} of ${notes.length}`}
        use:register={note.id}
        draggable={isManual}
        onfocus={() => (focusedId = note.id)}
        onkeydown={(e) => onRowKeydown(e, i)}
        ondragstart={(e) => onDragStart(e, note.id)}
        ondragover={(e) => onDragOver(e, note.id)}
        ondrop={(e) => onDrop(e, note.id)}
        ondragend={onDragEnd}
      >
        {#if isManual}
          <span class="handle" aria-hidden="true">⠿</span>
        {:else}
          <span class="handle locked" aria-hidden="true">🔒</span>
        {/if}
        <span class="name">{note.title || 'Untitled'}</span>
        <span class="pos" aria-hidden="true">{i + 1}</span>
      </div>
    {/each}
  </div>

  <p class="help" class:muted={!isManual}>
    {#if isManual}
      Drag to reorder · ↑/↓ to move between notes · Shift+↑/↓ to move a note
    {:else}
      Order is locked while sorting by {sortMode === 'title' ? 'title' : 'last edited'}. Switch to
      Manual to reorder.
    {/if}
  </p>
</div>

<style>
  .organize {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-subtle);
  }

  .title {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .close {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1;
    padding: 2px 4px;
    cursor: pointer;
    border-radius: 4px;
  }

  .close:hover {
    background: var(--bg);
    color: var(--text);
  }

  .sortbar {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .seg {
    flex: 1;
    appearance: none;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 6px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .seg:hover {
    color: var(--text);
    background: var(--bg-subtle);
  }

  .seg.active {
    color: var(--accent);
    border-color: var(--accent);
  }

  .seg:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px 8px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text);
    font-size: 13px;
    background: var(--bg);
  }

  .row + .row {
    margin-top: 4px;
  }

  .row:hover {
    background: var(--bg-subtle);
  }

  /* Persistent highlight on the current row (manual mode) so there's always a
     keyboard-ready target, even when DOM focus is briefly elsewhere. */
  .row.current {
    background: var(--bg-subtle);
    border-color: var(--accent);
  }

  .row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .row.dragging {
    opacity: 0.5;
  }

  /* Drop indicator: accent top border on the row a drag is hovering over. */
  .row.dragover {
    border-color: var(--accent);
  }

  .row.locked {
    color: var(--text-muted);
  }

  .handle {
    flex: none;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1;
    cursor: grab;
    user-select: none;
  }

  .row.locked .handle {
    cursor: default;
    font-size: 11px;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pos {
    flex: none;
    color: var(--text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .help {
    margin: 0;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 11px;
    text-align: center;
  }

  .help.muted {
    font-style: italic;
    opacity: 0.85;
  }
</style>
