/**
 * `chrome.storage.session`-backed persistence for the search UI state.
 *
 * Session storage (in-memory, per browser session, not synced) is the right home
 * for "where the user left off": it restores search mode + query + collapsed
 * groups when the panel reopens, but nothing leaks to other devices or outlives
 * the browser. Kept separate from the notes/settings repositories because it is a
 * different domain and a different storage area.
 */

import { EMPTY_SEARCH_STATE, normalizeSearchState, type SearchState } from "./searchState";

const SEARCH_STATE_KEY = "search:state";

export class SessionSearchStateRepository {
  /** Injected for testability; defaults to the real session area. */
  constructor(private readonly area: chrome.storage.StorageArea = chrome.storage.session) {}

  async get(): Promise<SearchState> {
    const res = await this.area.get(SEARCH_STATE_KEY);
    return normalizeSearchState(res[SEARCH_STATE_KEY] as Partial<SearchState> | undefined);
  }

  async save(state: SearchState): Promise<void> {
    await this.area.set({ [SEARCH_STATE_KEY]: normalizeSearchState(state) });
  }

  /** Reset to the empty state (nothing open, no query). */
  async clear(): Promise<void> {
    await this.area.set({ [SEARCH_STATE_KEY]: EMPTY_SEARCH_STATE });
  }
}
