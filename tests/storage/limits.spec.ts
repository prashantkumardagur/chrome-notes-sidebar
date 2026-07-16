import { describe, expect, it } from "vitest";
import {
  bodyBytesRemaining,
  byteLength,
  canCreateNote,
  isBodyWithinBudget,
  MAX_NOTES,
  NOTE_BODY_BUDGET_BYTES,
  noteFitsSyncItem,
  noteItemBytes,
  SYNC_ITEM_LIMIT_BYTES,
} from "../../src/lib/storage/limits";
import type { Note } from "../../src/lib/storage/NotesRepository";

describe("byteLength", () => {
  it("counts ASCII as one byte each", () => {
    expect(byteLength("hello")).toBe(5);
    expect(byteLength("")).toBe(0);
  });

  it("counts multi-byte UTF-8 characters correctly", () => {
    expect(byteLength("é")).toBe(2); // U+00E9 -> 2 bytes
    expect(byteLength("😀")).toBe(4); // emoji -> 4 bytes
    expect(byteLength("a😀")).toBe(5);
  });
});

describe("body budget helpers", () => {
  it("budget leaves envelope room under the per-item limit", () => {
    expect(NOTE_BODY_BUDGET_BYTES).toBeLessThan(SYNC_ITEM_LIMIT_BYTES);
  });

  it("reports remaining bytes", () => {
    expect(bodyBytesRemaining("")).toBe(NOTE_BODY_BUDGET_BYTES);
    expect(bodyBytesRemaining("abc")).toBe(NOTE_BODY_BUDGET_BYTES - 3);
  });

  it("goes negative when over budget", () => {
    const tooBig = "x".repeat(NOTE_BODY_BUDGET_BYTES + 10);
    expect(bodyBytesRemaining(tooBig)).toBe(-10);
    expect(isBodyWithinBudget(tooBig)).toBe(false);
  });

  it("accepts a body exactly at the budget", () => {
    const exact = "x".repeat(NOTE_BODY_BUDGET_BYTES);
    expect(isBodyWithinBudget(exact)).toBe(true);
  });
});

describe("canCreateNote", () => {
  it("allows creation below the cap and blocks at/above it", () => {
    expect(canCreateNote(0)).toBe(true);
    expect(canCreateNote(MAX_NOTES - 1)).toBe(true);
    expect(canCreateNote(MAX_NOTES)).toBe(false);
    expect(canCreateNote(MAX_NOTES + 5)).toBe(false);
  });
});

describe("note item sizing", () => {
  const note: Note = {
    id: "abc",
    title: "Title",
    body: "hello world",
    createdAt: 0,
    updatedAt: 0,
  };

  it("measures the serialized note size", () => {
    expect(noteItemBytes(note)).toBe(byteLength(JSON.stringify(note)));
  });

  it("small notes fit within a sync item", () => {
    expect(noteFitsSyncItem(note)).toBe(true);
  });

  it("oversized notes do not fit", () => {
    const big: Note = { ...note, body: "x".repeat(SYNC_ITEM_LIMIT_BYTES) };
    expect(noteFitsSyncItem(big)).toBe(false);
  });
});
