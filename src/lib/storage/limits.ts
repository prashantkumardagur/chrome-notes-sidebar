/**
 * Storage caps derived from `chrome.storage.sync` limits.
 *
 * `chrome.storage.sync` allows ~100 KB total, ~8 KB per item, and 512 items.
 * We store one item per note plus a small index item, so we cap the note count
 * and give each note a byte budget that leaves room for its JSON envelope.
 *
 * All numbers and math live here so the rest of the app never hard-codes limits.
 */

import type { Note } from "./NotesRepository";

/** Maximum number of notes a user can keep. */
export const MAX_NOTES = 10;

/** `chrome.storage.sync` QUOTA_BYTES_PER_ITEM. */
export const SYNC_ITEM_LIMIT_BYTES = 8192;

/**
 * Bytes reserved for a note's JSON envelope (id, title, timestamps, the storage
 * key, and JSON punctuation) so the body budget alone can't overflow an item.
 */
export const NOTE_ENVELOPE_RESERVE_BYTES = 512;

/** Byte budget available to a single note's body text. */
export const NOTE_BODY_BUDGET_BYTES = SYNC_ITEM_LIMIT_BYTES - NOTE_ENVELOPE_RESERVE_BYTES;

/**
 * Per-note character limit shown to the user. Kept safely under
 * NOTE_BODY_BUDGET_BYTES so plain (ASCII) text can't overflow a sync item;
 * heavily multi-byte text is additionally guarded by the byte budget.
 */
export const MAX_NOTE_CHARS = 7500;

/** Usage ratio (0..1+) at which the counter should warn. */
export const NEAR_LIMIT_RATIO = 0.9;

const encoder = new TextEncoder();

/** UTF-8 byte length of a string (multi-byte aware). */
export function byteLength(text: string): number {
  return encoder.encode(text).length;
}

/** Bytes still available in a note body before hitting the budget (may be negative). */
export function bodyBytesRemaining(body: string): number {
  return NOTE_BODY_BUDGET_BYTES - byteLength(body);
}

/** Whether a note body fits within its byte budget. */
export function isBodyWithinBudget(body: string): boolean {
  return byteLength(body) <= NOTE_BODY_BUDGET_BYTES;
}

/** Whether another note can be created given the current count. */
export function canCreateNote(currentCount: number): boolean {
  return currentCount < MAX_NOTES;
}

/** Characters still available in a note body before the limit (may be negative). */
export function charsRemaining(body: string): number {
  return MAX_NOTE_CHARS - body.length;
}

/** Whether a note body is within the character limit. */
export function isWithinCharLimit(body: string): boolean {
  return body.length <= MAX_NOTE_CHARS;
}

/** Fraction (0..1+) of the character budget currently used. */
export function charUsageRatio(body: string): number {
  return body.length / MAX_NOTE_CHARS;
}

/** Whether a body is close enough to the character limit to warn the user. */
export function isNearCharLimit(body: string): boolean {
  return charUsageRatio(body) >= NEAR_LIMIT_RATIO;
}

/** Whether a body is safe to store: within both the character and byte budgets. */
export function bodyFitsStorage(body: string): boolean {
  return isWithinCharLimit(body) && isBodyWithinBudget(body);
}

/** Serialized byte size of a full note as it would be stored (envelope included). */
export function noteItemBytes(note: Note): number {
  return byteLength(JSON.stringify(note));
}

/** Whether a full note would fit within a single sync item. */
export function noteFitsSyncItem(note: Note): boolean {
  return noteItemBytes(note) <= SYNC_ITEM_LIMIT_BYTES;
}
