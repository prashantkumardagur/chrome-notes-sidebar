<script lang="ts">
  import {
    MAX_OCCURRENCES_PER_NOTE,
    MIN_QUERY_LENGTH,
    type NoteMatch,
    searchNotes,
    type NoteSearchResult,
  } from '../lib/search/search';
  import type { Note } from '../lib/storage/NotesRepository';
  import { debounce } from '../lib/util/debounce';

  const DEBOUNCE_MS = 200;

  let {
    notes,
    onOpen,
    onClose,
  }: {
    notes: Note[];
    onOpen: (noteId: string, match: NoteMatch) => void;
    onClose: () => void;
  } = $props();

  let query = $state('');
  // `applied` trails `query` by the debounce so results don't recompute on every keystroke.
  let applied = $state('');

  const applyQuery = debounce(() => {
    applied = query;
  }, DEBOUNCE_MS);

  function onInput() {
    applyQuery();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  // Flush any pending recompute when unmounting so nothing fires after close.
  $effect(() => () => applyQuery.cancel());

  const results = $derived<NoteSearchResult[]>(searchNotes(applied, notes));
  const tooShort = $derived(applied.trim().length < MIN_QUERY_LENGTH);
</script>

<div class="search">
  <div class="bar">
    <span class="glyph" aria-hidden="true">🔍</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="input"
      type="text"
      placeholder="Search all notes…"
      bind:value={query}
      oninput={onInput}
      onkeydown={onKeydown}
      autofocus
      aria-label="Search notes"
    />
    <button type="button" class="close" onclick={onClose} title="Close search" aria-label="Close search">
      ✕
    </button>
  </div>

  <div class="results">
    {#if tooShort}
      <p class="hint">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
    {:else if results.length === 0}
      <p class="hint">No matches.</p>
    {:else}
      {#each results as result (result.id)}
        <section class="group">
          <h2 class="group-title" title={result.title}>{result.title}</h2>
          {#each result.matches as match (match.start)}
            <button type="button" class="row" onclick={() => onOpen(result.id, match)}>
              <!-- Snippet is *raw* untrusted note text: slice around the match and put
                   the emphasis in its own element — never {@html}. -->
              <span class="snippet"
                >{match.snippet.slice(0, match.matchStart)}<mark
                  >{match.snippet.slice(match.matchStart, match.matchEnd)}</mark
                >{match.snippet.slice(match.matchEnd)}</span
              >
            </button>
          {/each}
          {#if result.totalMatches > MAX_OCCURRENCES_PER_NOTE}
            <p class="more">showing first {MAX_OCCURRENCES_PER_NOTE}/{result.totalMatches} in this note</p>
          {/if}
        </section>
      {/each}
    {/if}
  </div>
</div>

<style>
  .search {
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

  .glyph {
    font-size: 12px;
    opacity: 0.7;
  }

  .input {
    flex: 1;
    min-width: 0;
    appearance: none;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
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

  .results {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px 0;
  }

  .hint {
    margin: 0;
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }

  .group {
    margin-bottom: 4px;
  }

  .group-title {
    margin: 0;
    padding: 8px 12px 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row {
    display: block;
    width: 100%;
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    padding: 5px 12px;
    cursor: pointer;
  }

  .row:hover {
    background: var(--bg-subtle);
  }

  .snippet {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
  }

  .snippet mark {
    background: transparent;
    color: var(--accent);
    font-weight: 600;
  }

  .more {
    margin: 0;
    padding: 2px 12px 6px;
    color: var(--text-muted);
    font-size: 11px;
    font-style: italic;
  }
</style>
