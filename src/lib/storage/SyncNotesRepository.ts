/**
 * `chrome.storage.sync`-backed implementation of {@link NotesRepository}.
 *
 * This is the ONLY module that touches a chrome.storage API. Storage layout:
 *   - `notes:index` -> ordered NoteMeta[]
 *   - `note:<id>`   -> full Note
 */

import { MAX_NOTES } from "./limits";
import type { Note, NoteMeta, NotesRepository } from "./NotesRepository";
import { toMeta } from "./NotesRepository";

const INDEX_KEY = "notes:index";
const noteKey = (id: string) => `note:${id}`;

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class NoteLimitError extends Error {
  constructor() {
    super(`Note limit reached (max ${MAX_NOTES}).`);
    this.name = "NoteLimitError";
  }
}

export class SyncNotesRepository implements NotesRepository {
  /** Injected for testability; defaults to the real sync area. */
  constructor(private readonly area: chrome.storage.StorageArea = chrome.storage.sync) {}

  async list(): Promise<NoteMeta[]> {
    const res = await this.area.get(INDEX_KEY);
    return (res[INDEX_KEY] as NoteMeta[] | undefined) ?? [];
  }

  async get(id: string): Promise<Note | null> {
    const key = noteKey(id);
    const res = await this.area.get(key);
    return (res[key] as Note | undefined) ?? null;
  }

  async create(title = "Untitled"): Promise<Note> {
    const index = await this.list();
    if (index.length >= MAX_NOTES) throw new NoteLimitError();
    const now = Date.now();
    const note: Note = { id: genId(), title, body: "", createdAt: now, updatedAt: now };
    await this.area.set({ [noteKey(note.id)]: note });
    await this.writeIndex([...index, toMeta(note)]);
    return note;
  }

  async save(note: Note): Promise<Note> {
    const updated: Note = { ...note, updatedAt: Date.now() };
    await this.area.set({ [noteKey(updated.id)]: updated });
    const index = await this.list();
    const next = index.map((m) => (m.id === updated.id ? toMeta(updated) : m));
    await this.writeIndex(next);
    return updated;
  }

  async rename(id: string, title: string): Promise<void> {
    const note = await this.get(id);
    if (!note) return;
    await this.save({ ...note, title });
  }

  async delete(id: string): Promise<void> {
    await this.area.remove(noteKey(id));
    const index = await this.list();
    await this.writeIndex(index.filter((m) => m.id !== id));
  }

  async firstOrCreate(): Promise<Note> {
    const index = await this.list();
    if (index.length > 0) {
      const existing = await this.get(index[0].id);
      if (existing) return existing;
    }
    return this.create("My Note");
  }

  private async writeIndex(index: NoteMeta[]): Promise<void> {
    await this.area.set({ [INDEX_KEY]: index });
  }
}
