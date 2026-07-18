/** The transient surfaces that must be mutually exclusive (only one open at a time). */
export type Surface = "dropdown" | "settings" | "info" | "search";

/**
 * Next open surface after one toggles. Opening a surface closes any other; closing a
 * surface clears the state only if it was the one open (closing an already-closed
 * surface must not stomp whichever surface is currently open).
 */
export function nextSurface(current: Surface | null, id: Surface, open: boolean): Surface | null {
  if (open) return id;
  return current === id ? null : current;
}
