<script lang="ts">
  import { onMount } from 'svelte';
  import ViewEditTabs from '../components/ViewEditTabs.svelte';
  import MarkdownEditor from '../components/MarkdownEditor.svelte';
  import MarkdownView from '../components/MarkdownView.svelte';
  import { SyncNotesRepository } from '../lib/storage/SyncNotesRepository';
  import type { Note } from '../lib/storage/NotesRepository';
  import { debounce } from '../lib/util/debounce';

  const AUTOSAVE_DELAY_MS = 3000;
  const repo = new SyncNotesRepository();

  let note = $state<Note | null>(null);
  let body = $state('');
  let mode = $state<'edit' | 'view'>('edit');
  let status = $state<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');

  const save = debounce(async () => {
    if (!note) return;
    status = 'saving';
    const updated: Note = { ...note, body };
    try {
      await repo.save(updated);
      note = updated;
      status = 'saved';
    } catch (err) {
      console.error('Failed to save note:', err);
      status = 'unsaved';
    }
  }, AUTOSAVE_DELAY_MS);

  function onEdit() {
    status = 'unsaved';
    save();
  }

  onMount(async () => {
    note = await repo.firstOrCreate();
    body = note.body;
    status = 'saved';
  });

  // Flush a pending autosave if the panel is being hidden/closed.
  $effect(() => {
    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') save.flush();
    };
    document.addEventListener('visibilitychange', flushIfHidden);
    window.addEventListener('pagehide', save.flush);
    return () => {
      document.removeEventListener('visibilitychange', flushIfHidden);
      window.removeEventListener('pagehide', save.flush);
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
    <div class="note-name" title={note?.title ?? ''}>{note?.title ?? 'Loading…'}</div>
    <ViewEditTabs bind:mode />
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
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }

  .note-name {
    font-weight: 600;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
