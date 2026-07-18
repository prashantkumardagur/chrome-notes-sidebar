import { describe, expect, it } from "vitest";
import { SessionSearchStateRepository } from "../../src/lib/search/SessionSearchStateRepository";
import { EMPTY_SEARCH_STATE } from "../../src/lib/search/searchState";

/** Minimal in-memory stand-in for a chrome.storage.StorageArea. */
function fakeArea() {
  const store = new Map<string, unknown>();
  const area = {
    async get(key: string) {
      return store.has(key) ? { [key]: store.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    },
    async remove(key: string) {
      store.delete(key);
    },
  } as unknown as chrome.storage.StorageArea;
  return { area, store };
}

describe("SessionSearchStateRepository", () => {
  it("returns the empty state when nothing is stored", async () => {
    const repo = new SessionSearchStateRepository(fakeArea().area);
    expect(await repo.get()).toEqual(EMPTY_SEARCH_STATE);
  });

  it("round-trips a saved state", async () => {
    const repo = new SessionSearchStateRepository(fakeArea().area);
    const state = { active: true, query: "meeting", collapsed: ["n1"] };
    await repo.save(state);
    expect(await repo.get()).toEqual(state);
  });

  it("normalizes corrupt stored state on read", async () => {
    const { area, store } = fakeArea();
    store.set("search:state", { active: 1, query: null, collapsed: 7 });
    const repo = new SessionSearchStateRepository(area);
    expect(await repo.get()).toEqual(EMPTY_SEARCH_STATE);
  });

  it("clear() resets to the empty state", async () => {
    const repo = new SessionSearchStateRepository(fakeArea().area);
    await repo.save({ active: true, query: "x", collapsed: ["a"] });
    await repo.clear();
    expect(await repo.get()).toEqual(EMPTY_SEARCH_STATE);
  });
});
