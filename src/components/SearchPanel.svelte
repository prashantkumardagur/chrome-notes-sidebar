<script lang="ts">
  import { onMount } from 'svelte';
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
    query = $bindable(''),
    collapsed = $bindable(new Set()),
    onOpen,
    onClose,
  }: {
    notes: Note[];
    // Bindable so query + collapsed groups survive leaving/re-entering search (owned by App).
    query: string;
    collapsed: Set<string>;
    onOpen: (noteId: string, match: NoteMatch) => void;
    onClose: () => void;
  } = $props();

  // `applied` trails `query` by the debounce so results don't recompute on every keystroke.
  let applied = $state(query);
  let input: HTMLInputElement;

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

  function toggleGroup(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  onMount(() => {
    // Focus explicitly (not the `autofocus` attribute) so opening via the toolbar
    // click focuses the input too, and a restored query lands ready to edit.
    input?.focus();
    input?.select();
  });

  // Flush any pending recompute when unmounting so nothing fires after close.
  $effect(() => () => applyQuery.cancel());

  const results = $derived<NoteSearchResult[]>(searchNotes(applied, notes));
  const tooShort = $derived(applied.trim().length < MIN_QUERY_LENGTH);
</script>

<div class="search">
  <div class="bar">
    <span class="glyph" aria-hidden="true">🔍</span>
    <input
      class="input"
      type="text"
      placeholder="Search all notes…"
      bind:this={input}
      bind:value={query}
      oninput={onInput}
      onkeydown={onKeydown}
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
        {@const isCollapsed = collapsed.has(result.id)}
        <section class="group">
          <button
            type="button"
            class="group-title"
            onclick={() => toggleGroup(result.id)}
            aria-expanded={!isCollapsed}
            title={result.title}
          >
            <span class="caret" class:collapsed={isCollapsed} aria-hidden="true">▾</span>
            <span class="group-name">{result.title}</span>
            <span class="group-count">{result.totalMatches}</span>
          </button>
          {#if !isCollapsed}
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
    padding-bottom: 4px;
  }

  /* Dim separator between note groups (not above the first). */
  .group + .group {
    border-top: 1px solid var(--border);
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    appearance: none;
    border: none;
    background: transparent;
    text-align: left;
    padding: 8px 12px 2px;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    cursor: pointer;
  }

  .group-title:hover {
    color: var(--text);
  }

  .caret {
    flex: none;
    font-size: 10px;
    transition: transform 0.12s ease;
  }

  .caret.collapsed {
    transform: rotate(-90deg);
  }

  .group-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .group-count {
    flex: none;
    font-weight: 500;
    opacity: 0.8;
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
