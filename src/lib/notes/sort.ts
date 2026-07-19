/**
 * Pure ordering of note metas for a given sort mode. Used by the Organize surface
 * and by App to keep `notes:index` in sync while an auto-sort field is active.
 *
 * Never mutates the input — always returns a new array — so callers can compare the
 * result against the current order before deciding to write.
 */

import type { SortMode } from "../settings/settings";
import type { NoteMeta } from "../storage/NotesRepository";

/**
 * Return `notes` ordered for `mode`. `manual` returns a copy in the given order
 * (no sort); `title` is case-insensitive locale A–Z (stable); `updated` is
 * `updatedAt` descending (newest first).
 */
export function sortNotes(notes: NoteMeta[], mode: SortMode): NoteMeta[] {
  const copy = [...notes];
  if (mode === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  }
  if (mode === "updated") {
    return copy.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return copy;
}
