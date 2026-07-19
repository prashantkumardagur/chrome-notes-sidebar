import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncNotesRepository } from "../../src/lib/storage/SyncNotesRepository";

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
  };
  return { store, area: area as unknown as chrome.storage.StorageArea };
}

function makeRepo() {
  const { store, area } = fakeArea();
  return { store, repo: new SyncNotesRepository(area) };
}

describe("SyncNotesRepository.reorder", () => {
  beforeEach(() => {
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `id-${++n}` });
  });

  it("rewrites the index to match orderedIds and leaves note items untouched", async () => {
    const { repo, store } = makeRepo();
    const a = await repo.create("A");
    const b = await repo.create("B");
    const c = await repo.create("C");
    const beforeItems = { a: store.get(`note:${a.id}`), b: store.get(`note:${b.id}`), c: store.get(`note:${c.id}`) };

    await repo.reorder([c.id, a.id, b.id]);

    expect((await repo.list()).map((m) => m.id)).toEqual([c.id, a.id, b.id]);
    // The note:<id> items are unchanged (order lives only in the index).
    expect(store.get(`note:${a.id}`)).toEqual(beforeItems.a);
    expect(store.get(`note:${b.id}`)).toEqual(beforeItems.b);
    expect(store.get(`note:${c.id}`)).toEqual(beforeItems.c);
  });

  it("ignores unknown ids in orderedIds", async () => {
    const { repo } = makeRepo();
    const a = await repo.create("A");
    const b = await repo.create("B");

    await repo.reorder([b.id, "ghost", a.id]);

    expect((await repo.list()).map((m) => m.id)).toEqual([b.id, a.id]);
  });

  it("keeps index metas missing from orderedIds (appended), so no note is lost", async () => {
    const { repo } = makeRepo();
    const a = await repo.create("A");
    const b = await repo.create("B");
    const c = await repo.create("C");

    // Caller only knows about c and a (stale set); b must not be dropped.
    await repo.reorder([c.id, a.id]);

    expect((await repo.list()).map((m) => m.id)).toEqual([c.id, a.id, b.id]);
  });

  it("is a no-op-shaped write on an empty id set (index unchanged order)", async () => {
    const { repo } = makeRepo();
    const a = await repo.create("A");
    const b = await repo.create("B");

    await repo.reorder([]);

    // Nothing named → everything kept in existing relative order.
    expect((await repo.list()).map((m) => m.id)).toEqual([a.id, b.id]);
  });
});
