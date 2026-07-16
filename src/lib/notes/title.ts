/** Default title given to new notes before the user renames them. */
export const DEFAULT_NOTE_TITLE = "Untitled";

/**
 * Pick a non-colliding default title for a new note: "Untitled", then
 * "Untitled 2", "Untitled 3", ... skipping any already in use.
 */
export function nextUntitledTitle(existingTitles: readonly string[]): string {
  const taken = new Set(existingTitles);
  if (!taken.has(DEFAULT_NOTE_TITLE)) return DEFAULT_NOTE_TITLE;
  for (let n = 2; ; n++) {
    const candidate = `${DEFAULT_NOTE_TITLE} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Normalize a user-entered title: trim, collapse to a fallback if empty. */
export function normalizeTitle(input: string): string {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_NOTE_TITLE;
}
