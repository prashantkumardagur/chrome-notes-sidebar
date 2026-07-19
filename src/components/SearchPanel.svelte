<script lang="ts">
  import { onMount } from 'svelte';
  import {
    flattenSearchRows,
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
    caseSensitive = $bindable(false),
    onOpen,
    onClose,
  }: {
    notes: Note[];
    // Bindable so query + collapsed groups + case toggle survive leaving/re-entering search (owned by App).
    query: string;
    collapsed: Set<string>;
    caseSensitive: boolean;
    // `index` is the clicked occurrence's position within this note's `matches`,
    // used as the nearest-occurrence target when highlighting in View mode.
    onOpen: (noteId: string, match: NoteMatch, index: number) => void;
    onClose: () => void;
  } = $props();

  // `applied` trails `query` by the debounce so results don't recompute on every keystroke.
  let applied = $state(query);
  let input: HTMLInputElement;

  // The result row that currently holds the keyboard highlight (its stable key), or
  // null when focus is in the search box. Mirrors OrganizeNotes' `current` highlight.
  let currentKey = $state<string | null>(null);
  const rowEls = new Map<string, HTMLElement>();

  // Register each rendered row element by key so keyboard nav can move focus between rows.
  function registerRow(el: HTMLElement, key: string) {
    rowEls.set(key, el);
    return {
      update(nextKey: string) {
        rowEls.delete(key);
        key = nextKey;
        rowEls.set(key, el);
      },
      destroy() {
        rowEls.delete(key);
      },
    };
  }

  function focusRow(key: string) {
    currentKey = key;
    rowEls.get(key)?.focus();
  }

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
      return;
    }
    // Down from the search box drops into the first visible result.
    if (e.key === 'ArrowDown' && flatRows.length > 0) {
      e.preventDefault();
      focusRow(flatRows[0].key);
    }
  }

  function onRowKeydown(e: KeyboardEvent, key: string) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const i = flatRows.findIndex((row) => row.key === key);
    if (i === -1) return;
    if (e.key === 'ArrowUp') {
      // Up from the first result returns focus to the search box; otherwise move up one.
      if (i === 0) {
        currentKey = null;
        input?.focus();
      } else {
        focusRow(flatRows[i - 1].key);
      }
    } else if (i < flatRows.length - 1) {
      focusRow(flatRows[i + 1].key);
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

  // Recomputes on query (debounced via `applied`), notes, AND the case toggle —
  // flipping `caseSensitive` re-runs the search immediately (it changes the `i` flag).
  const outcome = $derived(searchNotes(applied, notes, { caseSensitive }));
  const results = $derived<NoteSearchResult[]>(outcome.results);
  const searchError = $derived(outcome.error);

  // Visible rows in top-to-bottom order — the arrow-key navigation sequence.
  const flatRows = $derived(flattenSearchRows(results, collapsed));

  // Drop the highlight when the visible rows change (new query / toggled group),
  // so a stale key can't keep an unfocused row lit.
  $effect(() => {
    void flatRows;
    if (currentKey !== null && !flatRows.some((row) => row.key === currentKey)) {
      currentKey = null;
    }
  });
</script>

<div class="search">
  <div class="bar">
    <span class="glyph" aria-hidden="true">🔍</span>
    <input
      class="input"
      type="text"
      placeholder="Search all notes (regex)…"
      bind:this={input}
      bind:value={query}
      oninput={onInput}
      onkeydown={onKeydown}
      aria-label="Search notes"
    />
    <button
      type="button"
      class="toggle"
      class:active={caseSensitive}
      aria-pressed={caseSensitive}
      onclick={() => (caseSensitive = !caseSensitive)}
      title="Match case"
      aria-label="Match case"
    >
      Aa
    </button>
    <button type="button" class="close" onclick={onClose} title="Close search" aria-label="Close search">
      ✕
    </button>
  </div>

  <div class="results">
    {#if searchError === 'too-short'}
      <p class="hint">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
    {:else if searchError === 'invalid-regex'}
      <p class="hint error">Invalid regular expression.</p>
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
            {#each result.matches as match, i (match.start)}
              {@const key = `${result.id}:${match.start}`}
              <button
                type="button"
                class="row"
                class:current={currentKey === key}
                use:registerRow={key}
                onclick={() => onOpen(result.id, match, i)}
                onfocus={() => (currentKey = key)}
                onkeydown={(e) => onRowKeydown(e, key)}
              >
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

  .toggle {
    flex: none;
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    padding: 2px 5px;
    cursor: pointer;
    border-radius: 4px;
  }

  .toggle:hover {
    background: var(--bg);
    color: var(--text);
  }

  /* Pressed: accent-tinted so "match case is on" reads at a glance. */
  .toggle.active {
    color: var(--accent);
    border-color: var(--accent);
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
    padding: 6px 8px;
  }

  .hint {
    margin: 0;
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }

  /* Invalid-regex feedback: distinct from the neutral "no matches" hint. */
  .hint.error {
    color: var(--danger, #d94040);
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
    padding: 8px 8px 2px;
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
    /* Transparent border reserves the space the accent highlight fills — no shift. */
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    padding: 5px 8px;
    cursor: pointer;
  }

  .row:hover {
    background: var(--bg-subtle);
  }

  /* Keyboard highlight on the current row — matches OrganizeNotes' `.row.current`. */
  .row.current {
    background: var(--bg-subtle);
    border-color: var(--accent);
  }

  .row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
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
    padding: 2px 8px 6px;
    color: var(--text-muted);
    font-size: 11px;
    font-style: italic;
  }
</style>
