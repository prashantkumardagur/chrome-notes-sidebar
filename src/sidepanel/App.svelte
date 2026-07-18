<script lang="ts">
  import { onMount } from 'svelte';
  import CharCounter from '../components/CharCounter.svelte';
  import MarkdownEditor from '../components/MarkdownEditor.svelte';
  import MarkdownView from '../components/MarkdownView.svelte';
  import NoteSelector from '../components/NoteSelector.svelte';
  import SearchPanel from '../components/SearchPanel.svelte';
  import SettingsMenu from '../components/SettingsMenu.svelte';
  import UtilityBar from '../components/UtilityBar.svelte';
  import ViewEditTabs from '../components/ViewEditTabs.svelte';
  import { backupFileName, buildBackup, parseBackup, serializeBackup } from '../lib/backup/backup';
  import { nextUntitledTitle, normalizeTitle } from '../lib/notes/title';
  import type { NoteMatch } from '../lib/search/search';
  import { SessionSearchStateRepository } from '../lib/search/SessionSearchStateRepository';
  import { applyTheme, DEFAULT_SETTINGS, resolveViewMode, type Settings } from '../lib/settings/settings';
  import { SyncSettingsRepository } from '../lib/settings/SyncSettingsRepository';
  import type { Note, NoteMeta } from '../lib/storage/NotesRepository';
  import { bodyFitsStorage, MAX_NOTE_CHARS, MAX_NOTES } from '../lib/storage/limits';
  import { SyncNotesRepository } from '../lib/storage/SyncNotesRepository';
  import { debounce } from '../lib/util/debounce';

  const AUTOSAVE_DELAY_MS = 3000;
  const repo = new SyncNotesRepository();
  const settingsRepo = new SyncSettingsRepository();
  const searchStateRepo = new SessionSearchStateRepository();
  const version = chrome.runtime.getManifest().version;

  let notes = $state<NoteMeta[]>([]);
  let current = $state<Note | null>(null);
  let body = $state('');
  let mode = $state<'edit' | 'view'>('edit');
  let status = $state<'saved' | 'saving' | 'error'>('saved');
  let settings = $state<Settings>(DEFAULT_SETTINGS);
  let searching = $state(false);
  // Snapshot of every full note taken when search opens (list() only has metas).
  let searchNotesData = $state<Note[]>([]);
  // Kept across leaving/re-entering search (and panel close/reopen) so the user
  // returns to where they left: the query and which result groups were collapsed.
  let searchQuery = $state('');
  let searchCollapsed = $state<Set<string>>(new Set());
  // Guards the persist effect until the stored session state has been restored,
  // so we don't clobber it with defaults during startup.
  let searchHydrated = $state(false);
  // Guards the last-note persist effect until the mount restore has run, so a
  // note-change write can't clobber the stored cursor during startup.
  let noteHydrated = $state(false);

  // Keep the document theme in sync with the preference.
  $effect(() => applyTheme(settings.theme));

  function saveSettings(next: Settings) {
    settings = next;
    void settingsRepo.save(next);
  }

  const scheduleSave = debounce(() => {
    void persistCurrent();
  }, AUTOSAVE_DELAY_MS);

  async function refreshList() {
    notes = await repo.list();
  }

  async function persistCurrent() {
    if (!current) return;
    // Don't attempt to store a note that exceeds the sync item budget.
    if (!bodyFitsStorage(body)) {
      status = 'error';
      return;
    }
    status = 'saving';
    try {
      current = await repo.save({ ...current, body });
      await refreshList();
      status = 'saved';
    } catch (err) {
      console.error('Failed to save note:', err);
      status = 'error';
    }
  }

  /** Persist any pending edit immediately (before switching/closing). */
  async function commitPending() {
    scheduleSave.cancel();
    if (status === 'saving') await persistCurrent();
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
    status = 'saving';
    scheduleSave();
  }

  async function selectNote(id: string) {
    // Search is its own page: picking a note (from the selector or a result) leaves it.
    closeSearch();
    if (id === current?.id) return;
    await commitPending();
    await loadNote(id);
    // The view preference decides the mode on note change ('persistent' keeps it).
    mode = resolveViewMode(settings.view, mode);
  }

  /** Enter search mode: flush pending edits, then snapshot every full note body. */
  async function openSearch() {
    // Flush any pending autosave so the snapshot reflects the latest text (incl. unsaved edits).
    await commitPending();
    const metas = await repo.list();
    searchNotesData = (await Promise.all(metas.map((m) => repo.get(m.id)))).filter(
      (n): n is Note => n !== null,
    );
    searching = true;
  }

  function closeSearch() {
    searching = false;
  }

  function toggleSearch() {
    if (searching) closeSearch();
    else void openSearch();
  }

  // Opening a result switches to that note (selectNote leaves search + applies the
  // view preference). `match` is ignored here; it's the seam the highlighter builds on.
  // The query is preserved so returning to search restores the last results.
  async function openSearchResult(noteId: string, _match: NoteMatch) {
    await selectNote(noteId);
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

  /** Select the first note in the list, creating a default one if none exist. */
  async function selectFirstNote() {
    if (notes.length > 0) {
      await loadNote(notes[0].id);
      return;
    }
    const note = await repo.firstOrCreate();
    await refreshList();
    current = note;
    body = note.body;
    status = 'saved';
  }

  async function deleteNote(id: string) {
    // Deleting the current note discards its unsaved edits by design.
    if (id === current?.id) scheduleSave.cancel();
    await repo.delete(id);
    await refreshList();
    if (current?.id === id) await selectFirstNote();
  }

  /** Gather every note's full contents (list() only has metas) plus settings into one backup document. */
  async function exportBackup(): Promise<{ filename: string; content: string }> {
    // Flush any pending autosave first, so a rapid edit isn't silently missing from the export.
    await commitPending();
    const metas = await repo.list();
    const fullNotes = (await Promise.all(metas.map((m) => repo.get(m.id)))).filter(
      (n): n is Note => n !== null,
    );
    return { filename: backupFileName(), content: serializeBackup(buildBackup(settings, fullNotes)) };
  }

  /** Restore a backup: replaces every note and setting. Returns the count of entries dropped as invalid. */
  async function importBackup(raw: string): Promise<number> {
    const imported = parseBackup(raw);
    // Drop any pending autosave rather than flushing it — replaceAll is about to discard it anyway.
    scheduleSave.cancel();
    await repo.replaceAll(imported.notes);
    settings = await settingsRepo.save(imported.settings);
    await refreshList();
    await selectFirstNote();
    return imported.skippedCount;
  }

  onMount(async () => {
    settings = await settingsRepo.get();
    await refreshList();
    if (notes.length === 0) {
      const note = await repo.firstOrCreate();
      await refreshList();
      current = note;
      body = note.body;
    } else {
      // Reopen on the note the user last had open; fall back to notes[0] if the
      // remembered id is missing (deleted, imported away, or never set).
      const savedId = settings.lastNoteId;
      const targetId = savedId && notes.some((n) => n.id === savedId) ? savedId : notes[0].id;
      await loadNote(targetId);
    }
    status = 'saved';
    // Let the last-note persist effect run now that the restore is done.
    noteHydrated = true;

    // Restore where the user left off: their last query + collapsed groups, and
    // reopen search itself if that was the page they were on.
    const saved = await searchStateRepo.get();
    searchQuery = saved.query;
    searchCollapsed = new Set(saved.collapsed);
    if (saved.active) await openSearch();
    // Only now let the persist effect run, so it can't overwrite the restore with defaults.
    searchHydrated = true;
  });

  // Remember the current note as the cursor to restore on next panel open. Gated
  // on hydration so the mount restore can't be clobbered, and skips redundant
  // sync writes when the id is already stored.
  $effect(() => {
    const id = current?.id; // track it so the effect re-runs on note change
    if (!noteHydrated || !id) return;
    if (settings.lastNoteId === id) return;
    saveSettings({ ...settings, lastNoteId: id });
  });

  // Persist the search page state to session storage so it survives panel reopen.
  $effect(() => {
    // Read the tracked state up front so the effect subscribes even before hydration.
    const snapshot = { active: searching, query: searchQuery, collapsed: [...searchCollapsed] };
    if (!searchHydrated) return;
    void searchStateRepo.save(snapshot);
  });

  // Cmd/Ctrl+`/` toggles search. This listener lives in the panel document, so it
  // only fires when the side panel has focus — exactly the "only in our sidebar" scope.
  $effect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleSearch();
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
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
  const isSaved = $derived(status === 'saved');
  const statusText = $derived(status === 'error' ? 'Not saved' : status === 'saved' ? 'Saved' : 'Saving');
</script>

<div class="app">
  <header class="topbar">
    <NoteSelector
      {notes}
      currentId={current?.id ?? null}
      max={MAX_NOTES}
      onSelect={selectNote}
      onCreate={createNote}
      onRename={renameNote}
      onDelete={deleteNote}
      onSearch={toggleSearch}
      searchActive={searching}
    />
    <ViewEditTabs bind:mode />
  </header>

  <main class="content">
    {#if searching}
      <SearchPanel
        notes={searchNotesData}
        bind:query={searchQuery}
        bind:collapsed={searchCollapsed}
        onOpen={openSearchResult}
        onClose={closeSearch}
      />
    {:else if mode === 'edit'}
      <MarkdownEditor bind:value={body} oninput={onEdit} maxlength={MAX_NOTE_CHARS} />
    {:else}
      <MarkdownView source={body} />
    {/if}
  </main>

  <footer class="statusbar">
    <div class="tools">
      <UtilityBar
        {body}
        {version}
        updatedAt={current?.updatedAt ?? null}
        charLimit={MAX_NOTE_CHARS}
        noteCount={notes.length}
        maxNotes={MAX_NOTES}
      />
      <SettingsMenu {settings} onChange={saveSettings} onExport={exportBackup} onImport={importBackup} />
    </div>
    <div class="status" aria-live="polite">
      <span class="save" class:saved={isSaved}>{statusText}</span>
      <span class="dot" class:saved={isSaved} aria-hidden="true"></span>
      <CharCounter used={charCount} limit={MAX_NOTE_CHARS} />
    </div>
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
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
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

  .tools {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .save {
    color: var(--text-muted);
  }

  /* The dot doubles as the separator between the save state and the counter:
     red while saving / on error, green once saved. */
  .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #dc2626;
  }

  .dot.saved {
    background: #16a34a;
  }
</style>
