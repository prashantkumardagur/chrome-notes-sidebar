/**
 * Human-friendly "last edited" formatting for the info popover.
 *
 * Kept pure (and `now` injectable) so it's deterministic to unit-test; the UI
 * passes `Date.now()`.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** `1` -> "1 minute", `3` -> "3 minutes". */
function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * Relative time such as "just now", "5 minutes ago", "2 hours ago",
 * "3 days ago". Falls back to a locale date for anything older than a week.
 */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < MINUTE_MS) return "just now";
  if (diff < HOUR_MS) return plural(Math.floor(diff / MINUTE_MS), "minute");
  if (diff < DAY_MS) return plural(Math.floor(diff / HOUR_MS), "hour");
  if (diff < 7 * DAY_MS) return plural(Math.floor(diff / DAY_MS), "day");
  return new Date(timestamp).toLocaleDateString();
}
