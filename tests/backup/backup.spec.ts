import { describe, expect, it } from "vitest";
import {
  BackupParseError,
  backupFileName,
  buildBackup,
  parseBackup,
  serializeBackup,
} from "../../src/lib/backup/backup";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";
import { MAX_NOTES, NOTE_BODY_BUDGET_BYTES } from "../../src/lib/storage/limits";
import type { Note } from "../../src/lib/storage/NotesRepository";

function note(overrides: Partial<Note> = {}): Note {
  return { id: "n1", title: "Note", body: "hello", createdAt: 1, updatedAt: 2, ...overrides };
}

describe("buildBackup / serializeBackup", () => {
  it("bundles version, settings, and notes", () => {
    const payload = buildBackup(DEFAULT_SETTINGS, [note()], 12345);
    expect(payload).toEqual({ version: 1, exportedAt: 12345, settings: DEFAULT_SETTINGS, notes: [note()] });
  });

  it("serializes to JSON that round-trips through parseBackup", () => {
    const payload = buildBackup({ theme: "dark", view: "edit" }, [note()], 12345);
    const result = parseBackup(serializeBackup(payload));
    expect(result).toEqual({ settings: { theme: "dark", view: "edit" }, notes: [note()], skippedCount: 0 });
  });
});

describe("backupFileName", () => {
  it("formats as notes-backup-<ISO date>.json", () => {
    expect(backupFileName(new Date("2026-07-16T10:00:00Z"))).toBe("notes-backup-2026-07-16.json");
  });
});

describe("parseBackup", () => {
  it("throws BackupParseError on invalid JSON", () => {
    expect(() => parseBackup("not json")).toThrow(BackupParseError);
  });

  it("throws BackupParseError when the shape isn't a backup", () => {
    expect(() => parseBackup("{}")).toThrow(BackupParseError);
    expect(() => parseBackup('{"notes": "nope"}')).toThrow(BackupParseError);
    expect(() => parseBackup("null")).toThrow(BackupParseError);
    expect(() => parseBackup("[]")).toThrow(BackupParseError);
  });

  it("normalizes corrupt/partial settings back to defaults", () => {
    const result = parseBackup(JSON.stringify({ notes: [], settings: { theme: "neon" } }));
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid notes and normalizes empty titles", () => {
    const result = parseBackup(
      JSON.stringify({
        settings: DEFAULT_SETTINGS,
        notes: [note({ id: "a", title: "" }), note({ id: "b", title: "B" })],
      }),
    );
    expect(result.skippedCount).toBe(0);
    expect(result.notes).toEqual([note({ id: "a", title: "Untitled" }), note({ id: "b", title: "B" })]);
  });

  it("drops malformed notes and counts them as skipped", () => {
    const raw = JSON.stringify({
      settings: DEFAULT_SETTINGS,
      notes: [
        note({ id: "good" }),
        { id: "missing-body" },
        { id: 42, title: "bad id type", body: "x", createdAt: 1, updatedAt: 1 },
        "not an object",
        null,
      ],
    });
    const result = parseBackup(raw);
    expect(result.notes.map((n) => n.id)).toEqual(["good"]);
    expect(result.skippedCount).toBe(4);
  });

  it("drops notes whose body exceeds the storage byte budget", () => {
    const oversized = note({ id: "big", body: "x".repeat(NOTE_BODY_BUDGET_BYTES + 1) });
    const result = parseBackup(JSON.stringify({ settings: DEFAULT_SETTINGS, notes: [oversized] }));
    expect(result.notes).toEqual([]);
    expect(result.skippedCount).toBe(1);
  });

  it("deduplicates repeated ids, keeping the first", () => {
    const result = parseBackup(
      JSON.stringify({
        settings: DEFAULT_SETTINGS,
        notes: [note({ id: "dup", title: "First" }), note({ id: "dup", title: "Second" })],
      }),
    );
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].title).toBe("First");
    expect(result.skippedCount).toBe(1);
  });

  it("caps notes at MAX_NOTES and skips the rest", () => {
    const notes = Array.from({ length: MAX_NOTES + 3 }, (_, i) => note({ id: `n${i}` }));
    const result = parseBackup(JSON.stringify({ settings: DEFAULT_SETTINGS, notes }));
    expect(result.notes).toHaveLength(MAX_NOTES);
    expect(result.skippedCount).toBe(3);
  });

  it("accepts a missing settings field by falling back to defaults", () => {
    const result = parseBackup(JSON.stringify({ notes: [] }));
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.notes).toEqual([]);
  });
});
