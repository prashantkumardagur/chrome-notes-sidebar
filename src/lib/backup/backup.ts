/**
 * Full backup (export/import) of notes + settings as a single JSON document.
 *
 * Pure parsing/serialization logic lives here; the actual file download/pick
 * (DOM/browser APIs) stays in the settings UI, and persistence stays behind
 * the NotesRepository/SettingsRepository seams.
 */

import { normalizeTitle } from "../notes/title";
import { normalizeSettings, type Settings } from "../settings/settings";
import { bodyFitsStorage, MAX_NOTES, noteFitsSyncItem } from "../storage/limits";
import type { Note } from "../storage/NotesRepository";

export const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  settings: Settings;
  notes: Note[];
}

/** Result of parsing an imported backup: sanitized data plus a drop count. */
export interface ImportResult {
  settings: Settings;
  notes: Note[];
  /** Notes present in the file but dropped: malformed, oversized, duplicate id, or beyond MAX_NOTES. */
  skippedCount: number;
}

export class BackupParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupParseError";
  }
}

export function buildBackup(settings: Settings, notes: Note[], exportedAt: number = Date.now()): BackupPayload {
  return { version: BACKUP_VERSION, exportedAt, settings, notes };
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** File name for a fresh export, e.g. `notes-backup-2026-07-16.json`. */
export function backupFileName(date: Date = new Date()): string {
  return `notes-backup-${date.toISOString().slice(0, 10)}.json`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate and clean a single imported note; `null` if it can't be trusted. */
function sanitizeNote(raw: unknown): Note | null {
  if (!isPlainObject(raw)) return null;
  const { id, title, body, createdAt, updatedAt } = raw;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof body !== "string") return null;
  if (typeof createdAt !== "number" || typeof updatedAt !== "number") return null;
  const note: Note = { id, title: normalizeTitle(typeof title === "string" ? title : ""), body, createdAt, updatedAt };
  // Hold imports to the same budget the editor enforces on save: the body must be within the
  // char + byte budget (`bodyFitsStorage`), and the full note — title and key envelope included —
  // must fit a single sync item (`noteFitsSyncItem`). Otherwise a note could import but fail to
  // re-save, or overflow the real per-item quota on write.
  return bodyFitsStorage(note.body) && noteFitsSyncItem(note) ? note : null;
}

/**
 * Parse and sanitize a backup JSON string. Throws {@link BackupParseError} for
 * input that isn't a recognizable backup at all; individual bad/duplicate/
 * over-the-cap notes are silently dropped and counted in `skippedCount`
 * rather than failing the whole import.
 */
export function parseBackup(raw: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupParseError("That file isn't valid JSON.");
  }
  if (!isPlainObject(data) || !Array.isArray(data.notes)) {
    throw new BackupParseError("That file isn't a recognized notes backup.");
  }
  if (data.version !== BACKUP_VERSION) {
    throw new BackupParseError(`Unsupported backup version: ${JSON.stringify(data.version)}.`);
  }

  const settings = normalizeSettings(data.settings as Partial<Settings> | null | undefined);

  const seen = new Set<string>();
  const sanitized: Note[] = [];
  let skippedCount = 0;
  for (const rawNote of data.notes) {
    const note = sanitizeNote(rawNote);
    if (!note || seen.has(note.id)) {
      skippedCount++;
      continue;
    }
    seen.add(note.id);
    sanitized.push(note);
  }

  const notes = sanitized.slice(0, MAX_NOTES);
  skippedCount += sanitized.length - notes.length;

  return { settings, notes, skippedCount };
}
