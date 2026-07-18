/**
 * Ephemeral search-UI state that survives the side panel closing and reopening,
 * so the user returns to the page they left. It is deliberately *session*-scoped
 * (see {@link SessionSearchStateRepository}): unlike notes/settings it must not
 * sync across devices, and it should clear when the browser restarts.
 */

export interface SearchState {
  /** Whether search mode was open. */
  active: boolean;
  /** The last query text. */
  query: string;
  /** Ids of notes whose result group was collapsed. */
  collapsed: string[];
  /** Whether the regex case-sensitivity toggle was on. */
  caseSensitive: boolean;
}

export const EMPTY_SEARCH_STATE: SearchState = { active: false, query: "", collapsed: [], caseSensitive: false };

/** Coerce whatever was stored (possibly partial/corrupt) into a valid SearchState. */
export function normalizeSearchState(raw: Partial<SearchState> | undefined): SearchState {
  if (!raw) return EMPTY_SEARCH_STATE;
  return {
    active: raw.active === true,
    query: typeof raw.query === "string" ? raw.query : "",
    collapsed: Array.isArray(raw.collapsed) ? raw.collapsed.filter((id) => typeof id === "string") : [],
    // Older records predate this field → default off.
    caseSensitive: raw.caseSensitive === true,
  };
}
