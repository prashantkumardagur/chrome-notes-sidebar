<script lang="ts">
  import { onMount, tick } from 'svelte';
  import CharCounter from '../components/CharCounter.svelte';
  import MarkdownEditor from '../components/MarkdownEditor.svelte';
  import MarkdownView from '../components/MarkdownView.svelte';
  import NoteSelector from '../components/NoteSelector.svelte';
  import OrganizeNotes from '../components/OrganizeNotes.svelte';
  import SearchPanel from '../components/SearchPanel.svelte';
  import SettingsPanel from '../components/SettingsPanel.svelte';
  import UtilityBar from '../components/UtilityBar.svelte';
  import ViewEditTabs from '../components/ViewEditTabs.svelte';
  import { backupFileName, buildBackup, parseBackup, serializeBackup } from '../lib/backup/backup';
  import { toggleTaskAtIndex } from '../lib/markdown/tasks';
  import { sortNotes } from '../lib/notes/sort';
  import { nextUntitledTitle, normalizeTitle } from '../lib/notes/title';
  import type { NoteMatch } from '../lib/search/search';
  import { SessionSearchStateRepository } from '../lib/search/SessionSearchStateRepository';
  import {
    applyEditorVars,
    applyTheme,
    DEFAULT_SETTINGS,
    DEFAULT_WORD_WRAP,
    resolveEditorVars,
    resolveViewMode,
    type Settings,
    type SortMode,
  } from '../lib/settings/settings';
  import { SyncSettingsRepository } from '../lib/settings/SyncSettingsRepository';
  import { matchShortcut } from '../lib/shortcuts/keymap';
  import type { Note, NoteMeta } from '../lib/storage/NotesRepository';
  import { bodyFitsStorage, MAX_NOTE_CHARS, MAX_NOTES } from '../lib/storage/limits';
  import { SyncNotesRepository } from '../lib/storage/SyncNotesRepository';
  import { nextSurface, type Surface } from '../lib/ui/surfaces';
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
  // Bumped to ask NoteSelector to open the current note's name in rename mode (new-note
  // button + the rename shortcut). The new-note *shortcut* deliberately skips this.
  let renameSignal = $state(0);
  // Bound to the MarkdownEditor instance (edit mode only) so we can move focus into the
  // textarea after a rename or a shortcut-created note. Undefined whenever it isn't mounted.
  let editorRef = $state<MarkdownEditor>();
  // Single source of truth for which transient surface (dropdown/settings/info/search)
  // is open — only one at a time. See src/lib/ui/surfaces.ts.
  let activeSurface = $state<Surface | null>(null);
  const searching = $derived(activeSurface === 'search');
  const showSettings = $derived(activeSurface === 'settings');
  const organizing = $derived(activeSurface === 'organize');
  // The active sort field; absence in settings means the default `manual` order.
  const sortMode = $derived<SortMode>(settings.sortMode ?? 'manual');
  // Snapshot of every full note taken when search opens (list() only has metas).
  let searchNotesData = $state<Note[]>([]);
  // Kept across leaving/re-entering search (and panel close/reopen) so the user
  // returns to where they left: the query and which result groups were collapsed.
  let searchQuery = $state('');
  let searchCollapsed = $state<Set<string>>(new Set());
  // Regex case-sensitivity toggle; persisted alongside query/collapsed.
  let searchCaseSensitive = $state(false);
  // Guards the persist effect until the stored session state has been restored,
  // so we don't clobber it with defaults during startup.
  let searchHydrated = $state(false);
  // Guards the last-note persist effect until the mount restore has run, so a
  // note-change write can't clobber the stored cursor during startup.
  let noteHydrated = $state(false);
  // Jump-to-match state set when a search result is opened, consumed by the editor
  // (native selection) or the view (rendered <mark>s). Exactly one is non-null at a
  // time — whichever matches the mode the note opened in — and both reset on any
  // interaction (edit/dismiss), note switch, or Edit/View toggle so nothing lingers.
  let pendingSelect = $state<{ start: number; end: number } | null>(null);
  let pendingHighlight = $state<{ query: string; nearestIndex: number } | null>(null);

  function clearPendingHighlight() {
    pendingSelect = null;
    pendingHighlight = null;
  }

  // Keep the document theme in sync with the preference.
  $effect(() => applyTheme(settings.theme));

  // Apply the editor prefs as CSS vars at the root, same pattern as the theme.
  // Runs on load (settings restored in onMount) and on every settings change.
  $effect(() => applyEditorVars(resolveEditorVars(settings)));

  function saveSettings(next: Settings) {
    settings = next;
    void settingsRepo.save(next);
  }

  /** Coordinate the mutually-exclusive transient surfaces: opening one closes any other. */
  function setSurface(id: Surface, open: boolean) {
    activeSurface = nextSurface(activeSurface, id, open);
  }

  const scheduleSave = debounce(() => {
    void persistCurrent();
  }, AUTOSAVE_DELAY_MS);

  async function refreshList() {
    notes = await repo.list();
    // While an auto-sort field is active, keep the stored order in sync after any
    // mutation that reaches here (create/save/rename/delete/import). No-op in manual.
    await applyAutoSort();
  }

  function sameOrder(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((id, i) => id === b[i]);
  }

  /**
   * When an auto-sort field is active, rewrite `notes:index` to the sorted order —
   * but only when it actually differs, so we don't burn a sync write on every save.
   * Does not call refreshList (would recurse); re-reads the index once itself.
   */
  async function applyAutoSort() {
    // Read the mode off settings directly (not the derived) so a call right after
    // changeSortMode sees the just-saved value without waiting for a reactive flush.
    const mode = settings.sortMode ?? 'manual';
    if (mode === 'manual') return;
    const sorted = sortNotes(notes, mode);
    if (sameOrder(notes.map((n) => n.id), sorted.map((n) => n.id))) return;
    await repo.reorder(sorted.map((n) => n.id));
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
    // Typing invalidates the jump-to-match selection, so drop it (the native
    // selection is already gone) to keep it from re-applying on a later remount.
    pendingSelect = null;
    status = 'saving';
    scheduleSave();
  }

  // Ticking a task checkbox in View mode: flip the matching source marker, then run the
  // same edit path as typing so the change renders and autosaves (a 1-char swap never
  // approaches the char cap, so no budget guard is needed).
  function toggleTask(index: number) {
    body = toggleTaskAtIndex(body, index);
    onEdit();
  }

  async function selectNote(id: string) {
    // Search is its own page: picking a note (from the selector or a result) leaves it.
    closeSearch();
    // A note switch always clears any pending jump-to-match highlight.
    clearPendingHighlight();
    if (id === current?.id) return;
    await commitPending();
    await loadNote(id);
    // The view preference decides the mode on note change ('persistent' keeps it).
    mode = resolveViewMode(settings.view, mode);
  }

  /** Move to the previous/next note in the current list order, wrapping at the ends.
   *  No-op with a single note; falls back to the first note if the current id is gone.
   *  selectNote already flushes pending edits and applies the view preference. */
  function cycleNote(delta: number) {
    if (notes.length <= 1) return;
    const idx = notes.findIndex((n) => n.id === current?.id);
    if (idx === -1) {
      void selectNote(notes[0].id);
      return;
    }
    const next = (idx + delta + notes.length) % notes.length;
    void selectNote(notes[next].id);
  }

  /** Enter search mode: flush pending edits, then snapshot every full note body. */
  async function openSearch() {
    // Flush any pending autosave so the snapshot reflects the latest text (incl. unsaved edits).
    await commitPending();
    const metas = await repo.list();
    searchNotesData = (await Promise.all(metas.map((m) => repo.get(m.id)))).filter(
      (n): n is Note => n !== null,
    );
    // Flip to search only after the snapshot is populated, so the page never renders empty.
    activeSurface = 'search';
  }

  function closeSearch() {
    setSurface('search', false);
  }

  function toggleSearch() {
    if (searching) closeSearch();
    else void openSearch();
  }

  /** Enter the settings page: flush pending edits first (mirrors openSearch), same reasoning —
   *  the editor unmounts when the page replaces it, so an in-flight edit must be saved first. */
  async function openSettings() {
    await commitPending();
    setSurface('settings', true);
  }

  function closeSettings() {
    setSurface('settings', false);
  }

  function toggleSettings() {
    if (showSettings) closeSettings();
    else void openSettings();
  }

  /** Enter the Organize page. Flush pending edits first so a rename in flight is
   *  reflected in the Title sort (same reasoning as openSearch/openSettings). */
  async function openOrganize() {
    await commitPending();
    setSurface('organize', true);
  }

  function closeOrganize() {
    setSurface('organize', false);
  }

  /** Manual reorder from the Organize surface: persist the new order, then re-read. */
  async function reorderNotes(orderedIds: string[]) {
    await repo.reorder(orderedIds);
    await refreshList();
  }

  /** Change the sort field: persist it (omit when manual to keep the stored object
   *  clean), then apply the new order. Switching to manual leaves the order as-is. */
  function changeSortMode(mode: SortMode) {
    const next: Settings = { ...settings };
    if (mode === 'manual') delete next.sortMode;
    else next.sortMode = mode;
    saveSettings(next);
    void applyAutoSort();
  }

  // Opening a result switches to that note (selectNote leaves search + applies the
  // view preference), then arms the jump-to-match highlight for whichever mode the
  // note actually opened in. The query is preserved so returning to search restores
  // the last results.
  async function openSearchResult(noteId: string, match: NoteMatch, index: number) {
    await selectNote(noteId);
    if (mode === 'edit') {
      pendingSelect = { start: match.start, end: match.end };
    } else {
      // The matched text (original case) is exactly the searched substring; deriving
      // it from the body avoids threading the raw query through the open call.
      pendingHighlight = { query: body.slice(match.start, match.end), nearestIndex: index };
    }
  }

  // `rename: true` (the New note button) drops into naming the note; `rename: false`
  // (the new-note shortcut) keeps "Untitled" and jumps straight into the editor to type.
  async function createNote({ rename }: { rename: boolean }) {
    if (notes.length >= MAX_NOTES) return;
    await commitPending();
    const note = await repo.create(nextUntitledTitle(notes.map((n) => n.title)));
    await refreshList();
    current = note;
    body = note.body;
    status = 'saved';
    mode = 'edit';
    if (rename) renameSignal += 1;
    else await focusEditor();
  }

  /** Move focus into the editor textarea once it's rendered; no-ops if it isn't (e.g. View mode). */
  async function focusEditor() {
    await tick();
    editorRef?.focus();
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
    searchCaseSensitive = saved.caseSensitive;
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
    const snapshot = {
      active: searching,
      query: searchQuery,
      collapsed: [...searchCollapsed],
      caseSensitive: searchCaseSensitive,
    };
    if (!searchHydrated) return;
    void searchStateRepo.save(snapshot);
  });

  // In-panel keyboard shortcuts. This listener lives in the panel document, so it only
  // fires when the side panel has focus — exactly the "only in our sidebar" scope. A
  // pure keymap (src/lib/shortcuts/keymap.ts) resolves the event to an action, keeping
  // the bindings in one testable place. We only preventDefault on a match, so every
  // other combo (the textarea's ⌘A/C/V/X/Z, the toolbar's ⌘B/I/K) passes through.
  $effect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const action = matchShortcut(e);
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case 'toggle-search':
          toggleSearch();
          break;
        case 'toggle-settings':
          toggleSettings();
          break;
        case 'toggle-info':
          setSurface('info', activeSurface !== 'info');
          break;
        case 'toggle-view':
          mode = mode === 'edit' ? 'view' : 'edit';
          // Mirror the View/Edit tabs, which drop any jump-to-match highlight on toggle.
          clearPendingHighlight();
          break;
        case 'new-note':
          void createNote({ rename: false });
          break;
        case 'rename-note':
          // Same as clicking ✎: open the current note's name in rename mode.
          renameSignal += 1;
          break;
        case 'prev-note':
          cycleNote(-1);
          break;
        case 'next-note':
          cycleNote(1);
          break;
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
      open={activeSurface === 'dropdown'}
      onOpenChange={(o) => setSurface('dropdown', o)}
      onSelect={selectNote}
      onCreate={() => void createNote({ rename: true })}
      onRename={renameNote}
      onRenameDone={() => void focusEditor()}
      onDelete={deleteNote}
      onSearch={toggleSearch}
      onOrganize={() => void openOrganize()}
      searchActive={searching}
      {renameSignal}
    />
    <ViewEditTabs bind:mode onchange={clearPendingHighlight} />
  </header>

  <main class="content">
    {#if searching}
      <SearchPanel
        notes={searchNotesData}
        bind:query={searchQuery}
        bind:collapsed={searchCollapsed}
        bind:caseSensitive={searchCaseSensitive}
        onOpen={openSearchResult}
        onClose={closeSearch}
      />
    {:else if organizing}
      <OrganizeNotes
        {notes}
        {sortMode}
        onSortModeChange={changeSortMode}
        onReorder={reorderNotes}
        onClose={closeOrganize}
      />
    {:else if showSettings}
      <SettingsPanel
        {settings}
        onChange={saveSettings}
        onExport={exportBackup}
        onImport={importBackup}
        onClose={closeSettings}
      />
    {:else if mode === 'edit'}
      <MarkdownEditor
        bind:this={editorRef}
        bind:value={body}
        oninput={onEdit}
        maxlength={MAX_NOTE_CHARS}
        select={pendingSelect}
        wrap={settings.wordWrap ?? DEFAULT_WORD_WRAP}
      />
    {:else}
      <MarkdownView
        source={body}
        highlight={pendingHighlight}
        onDismissHighlight={clearPendingHighlight}
        onToggleTask={toggleTask}
      />
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
        open={activeSurface === 'info'}
        onOpenChange={(o) => setSurface('info', o)}
      />
      <button
        type="button"
        class="settings-trigger"
        class:active={showSettings}
        onclick={toggleSettings}
        aria-pressed={showSettings}
        title="Settings"
        aria-label="Settings"
      >
        <span class="glyph" aria-hidden="true">⚙</span>
      </button>
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

  /* Standalone gear trigger, styled to match UtilityBar's tools but not part of its
     group. The gear glyph renders small and low on the baseline, so bump its size and
     center it with flex; the trimmed vertical padding keeps the box height equal to
     the neighbouring copy/info buttons. */
  .settings-trigger {
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

  .settings-trigger:hover {
    background: var(--bg-subtle);
    color: var(--text);
  }

  /* Accent-tinted while the settings page is open, matching NoteSelector's search toggle. */
  .settings-trigger.active {
    color: var(--accent);
    border-color: var(--accent);
  }

  /* The gear glyph's visual center sits below its font box; nudge it up so it
     reads as vertically centered within the button. */
  .glyph {
    display: block;
    transform: translateY(-1px);
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
