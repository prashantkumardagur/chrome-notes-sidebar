import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NoteLimitError,
  SyncNotesRepository,
} from '../../src/lib/storage/SyncNotesRepository';
import { MAX_NOTES } from '../../src/lib/storage/limits';

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

describe('SyncNotesRepository', () => {
  beforeEach(() => {
    // Deterministic ids for assertions.
    let n = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `id-${++n}` });
  });

  it('starts with an empty list', async () => {
    const { repo } = makeRepo();
    expect(await repo.list()).toEqual([]);
  });

  it('creates a note and records it in the index', async () => {
    const { repo, store } = makeRepo();
    const note = await repo.create('First');

    expect(note.title).toBe('First');
    expect(note.body).toBe('');
    expect(store.get('note:id-1')).toMatchObject({ id: 'id-1', title: 'First' });
    expect(await repo.list()).toEqual([
      { id: 'id-1', title: 'First', updatedAt: note.updatedAt },
    ]);
  });

  it('gets a note by id, or null when missing', async () => {
    const { repo } = makeRepo();
    const created = await repo.create('X');
    expect(await repo.get(created.id)).toMatchObject({ id: created.id, title: 'X' });
    expect(await repo.get('nope')).toBeNull();
  });

  it('saves body changes and refreshes updatedAt + index', async () => {
    const { repo } = makeRepo();
    const note = await repo.create('Note');
    vi.spyOn(Date, 'now').mockReturnValue(note.updatedAt + 5000);

    await repo.save({ ...note, body: 'hello', title: 'Renamed' });

    const reloaded = await repo.get(note.id);
    expect(reloaded?.body).toBe('hello');
    expect(reloaded?.updatedAt).toBe(note.updatedAt + 5000);
    const meta = (await repo.list())[0];
    expect(meta.title).toBe('Renamed');
    expect(meta.updatedAt).toBe(note.updatedAt + 5000);
  });

  it('renames a note', async () => {
    const { repo } = makeRepo();
    const note = await repo.create('Old');
    await repo.rename(note.id, 'New');
    expect((await repo.get(note.id))?.title).toBe('New');
    expect((await repo.list())[0].title).toBe('New');
  });

  it('rename on a missing note is a no-op', async () => {
    const { repo } = makeRepo();
    await expect(repo.rename('ghost', 'x')).resolves.toBeUndefined();
    expect(await repo.list()).toEqual([]);
  });

  it('deletes a note and its index entry', async () => {
    const { repo, store } = makeRepo();
    const a = await repo.create('A');
    const b = await repo.create('B');
    await repo.delete(a.id);

    expect(store.has(`note:${a.id}`)).toBe(false);
    expect(await repo.list()).toEqual([
      { id: b.id, title: 'B', updatedAt: b.updatedAt },
    ]);
  });

  it('throws NoteLimitError beyond MAX_NOTES', async () => {
    const { repo } = makeRepo();
    for (let i = 0; i < MAX_NOTES; i++) await repo.create(`n${i}`);
    await expect(repo.create('overflow')).rejects.toBeInstanceOf(NoteLimitError);
    expect(await repo.list()).toHaveLength(MAX_NOTES);
  });

  describe('firstOrCreate', () => {
    it('creates a default note when none exist', async () => {
      const { repo } = makeRepo();
      const note = await repo.firstOrCreate();
      expect(note.title).toBe('My Note');
      expect(await repo.list()).toHaveLength(1);
    });

    it('returns the existing first note without creating another', async () => {
      const { repo } = makeRepo();
      const created = await repo.create('Existing');
      const got = await repo.firstOrCreate();
      expect(got.id).toBe(created.id);
      expect(await repo.list()).toHaveLength(1);
    });
  });
});
