import { describe, expect, it } from "vitest";
import {
  bodyBytesRemaining,
  bodyFitsStorage,
  byteLength,
  canCreateNote,
  charsRemaining,
  charUsageRatio,
  isBodyWithinBudget,
  isNearCharLimit,
  isWithinCharLimit,
  MAX_NOTE_CHARS,
  MAX_NOTES,
  NEAR_LIMIT_RATIO,
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

describe("character budget helpers", () => {
  it("keeps the char limit safely under the byte budget", () => {
    expect(MAX_NOTE_CHARS).toBeLessThanOrEqual(NOTE_BODY_BUDGET_BYTES);
  });

  it("reports remaining characters", () => {
    expect(charsRemaining("")).toBe(MAX_NOTE_CHARS);
    expect(charsRemaining("abcde")).toBe(MAX_NOTE_CHARS - 5);
  });

  it("checks the character limit", () => {
    expect(isWithinCharLimit("x".repeat(MAX_NOTE_CHARS))).toBe(true);
    expect(isWithinCharLimit("x".repeat(MAX_NOTE_CHARS + 1))).toBe(false);
  });

  it("computes usage ratio", () => {
    expect(charUsageRatio("")).toBe(0);
    expect(charUsageRatio("x".repeat(MAX_NOTE_CHARS))).toBe(1);
  });

  it("flags bodies near the limit", () => {
    const belowThreshold = "x".repeat(Math.floor(MAX_NOTE_CHARS * NEAR_LIMIT_RATIO) - 1);
    const atThreshold = "x".repeat(Math.ceil(MAX_NOTE_CHARS * NEAR_LIMIT_RATIO));
    expect(isNearCharLimit(belowThreshold)).toBe(false);
    expect(isNearCharLimit(atThreshold)).toBe(true);
  });

  describe("bodyFitsStorage", () => {
    it("accepts normal text", () => {
      expect(bodyFitsStorage("a reasonable note")).toBe(true);
    });

    it("rejects text over the character limit", () => {
      expect(bodyFitsStorage("x".repeat(MAX_NOTE_CHARS + 1))).toBe(false);
    });

    it("rejects multi-byte text that fits chars but overflows bytes", () => {
      // Emoji are 2 UTF-16 units and 4 bytes each. Enough to exceed the byte
      // budget while staying under the character limit.
      const emojiCount = Math.floor(NOTE_BODY_BUDGET_BYTES / 4) + 10;
      const body = "😀".repeat(emojiCount);
      expect(isWithinCharLimit(body)).toBe(true);
      expect(isBodyWithinBudget(body)).toBe(false);
      expect(bodyFitsStorage(body)).toBe(false);
    });
  });
});
