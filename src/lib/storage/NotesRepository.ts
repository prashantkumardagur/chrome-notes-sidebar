/**
 * Backend-agnostic contract for note persistence.
 *
 * Every part of the app talks to storage through this interface only. The
 * concrete implementation (currently {@link SyncNotesRepository}, backed by
 * `chrome.storage.sync`) is the sole place that touches a storage API, so we
 * can swap backends later without changing UI or store code.
 */

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/** Lightweight summary kept in the index for the note selector. */
export interface NoteMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface NotesRepository {
  /** Ordered summaries of all notes. */
  list(): Promise<NoteMeta[]>;
  /** Full note by id, or `null` if it doesn't exist. */
  get(id: string): Promise<Note | null>;
  /** Create a new empty note. Throws if the note limit is reached. */
  create(title?: string): Promise<Note>;
  /** Persist a note's contents; returns the stored note with a fresh `updatedAt`. */
  save(note: Note): Promise<Note>;
  /** Change a note's title. */
  rename(id: string, title: string): Promise<void>;
  /** Remove a note and its index entry. */
  delete(id: string): Promise<void>;
  /** Return the first note, creating a default one if none exist. */
  firstOrCreate(): Promise<Note>;
}

export function toMeta(note: Note): NoteMeta {
  return { id: note.id, title: note.title, updatedAt: note.updatedAt };
}
