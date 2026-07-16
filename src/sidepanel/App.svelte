<script lang="ts">
  import { onMount } from 'svelte';
  import MarkdownEditor from '../components/MarkdownEditor.svelte';
  import MarkdownView from '../components/MarkdownView.svelte';
  import NoteSelector from '../components/NoteSelector.svelte';
  import ViewEditTabs from '../components/ViewEditTabs.svelte';
  import { nextUntitledTitle, normalizeTitle } from '../lib/notes/title';
  import type { Note, NoteMeta } from '../lib/storage/NotesRepository';
  import { MAX_NOTES } from '../lib/storage/limits';
  import { SyncNotesRepository } from '../lib/storage/SyncNotesRepository';
  import { debounce } from '../lib/util/debounce';

  const AUTOSAVE_DELAY_MS = 3000;
  const repo = new SyncNotesRepository();

  let notes = $state<NoteMeta[]>([]);
  let current = $state<Note | null>(null);
  let body = $state('');
  let mode = $state<'edit' | 'view'>('edit');
  let status = $state<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');

  const scheduleSave = debounce(() => {
    void persistCurrent();
  }, AUTOSAVE_DELAY_MS);

  async function refreshList() {
    notes = await repo.list();
  }

  async function persistCurrent() {
    if (!current) return;
    status = 'saving';
    try {
      current = await repo.save({ ...current, body });
      await refreshList();
      status = 'saved';
    } catch (err) {
      console.error('Failed to save note:', err);
      status = 'unsaved';
    }
  }

  /** Persist any pending edit immediately (before switching/closing). */
  async function commitPending() {
    scheduleSave.cancel();
    if (status === 'unsaved') await persistCurrent();
  }

  async function loadNote(id: string) {
    const note = await repo.get(id);
    if (note) {
      current = note;
      body = note.body;
      status = 'saved';
    }
  }

  function onEdit() {
    status = 'unsaved';
    scheduleSave();
  }

  async function selectNote(id: string) {
    if (id === current?.id) return;
    await commitPending();
    await loadNote(id);
  }

  async function createNote() {
    if (notes.length >= MAX_NOTES) return;
    await commitPending();
    const note = await repo.create(nextUntitledTitle(notes.map((n) => n.title)));
    await refreshList();
    current = note;
    body = note.body;
    status = 'saved';
    mode = 'edit';
  }

  async function renameNote(id: string, title: string) {
    const clean = normalizeTitle(title);
    await repo.rename(id, clean);
    await refreshList();
    if (current?.id === id) current = { ...current, title: clean };
  }

  async function deleteNote(id: string) {
    // Deleting the current note discards its unsaved edits by design.
    if (id === current?.id) scheduleSave.cancel();
    await repo.delete(id);
    await refreshList();
    if (current?.id === id) {
      if (notes.length > 0) await loadNote(notes[0].id);
      else {
        const note = await repo.firstOrCreate();
        await refreshList();
        current = note;
        body = note.body;
        status = 'saved';
      }
    }
  }

  onMount(async () => {
    await refreshList();
    if (notes.length === 0) {
      const note = await repo.firstOrCreate();
      await refreshList();
      current = note;
      body = note.body;
    } else {
      await loadNote(notes[0].id);
    }
    status = 'saved';
  });

  // Flush a pending autosave if the panel is being hidden/closed.
  $effect(() => {
    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') scheduleSave.flush();
    };
    document.addEventListener('visibilitychange', flushIfHidden);
    window.addEventListener('pagehide', scheduleSave.flush);
    return () => {
      document.removeEventListener('visibilitychange', flushIfHidden);
      window.removeEventListener('pagehide', scheduleSave.flush);
    };
  });

  const charCount = $derived(body.length);
  const statusLabel = $derived(
    status === 'saving'
      ? 'Saving…'
      : status === 'unsaved'
        ? 'Unsaved changes'
        : status === 'saved'
          ? 'Saved'
          : '',
  );
</script>

<div class="app">
  <header class="topbar">
    <div class="row">
      <NoteSelector
        {notes}
        currentId={current?.id ?? null}
        max={MAX_NOTES}
        onSelect={selectNote}
        onCreate={createNote}
        onRename={renameNote}
        onDelete={deleteNote}
      />
    </div>
    <div class="row tabs-row">
      <ViewEditTabs bind:mode />
    </div>
  </header>

  <main class="content">
    {#if mode === 'edit'}
      <MarkdownEditor bind:value={body} oninput={onEdit} />
    {:else}
      <MarkdownView source={body} />
    {/if}
  </main>

  <footer class="statusbar">
    <div class="tools" aria-live="polite">{statusLabel}</div>
    <div class="counter">{charCount.toLocaleString()} characters</div>
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .topbar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }

  .row {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .tabs-row {
    justify-content: flex-end;
  }

  .content {
    flex: 1;
    min-height: 0;
  }

  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--border);
    background: var(--bg-subtle);
    color: var(--text-muted);
    font-size: 11px;
  }
</style>
