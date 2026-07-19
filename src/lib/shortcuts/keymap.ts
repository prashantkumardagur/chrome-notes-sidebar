/**
 * Pure keymap for the side panel's in-panel keyboard shortcuts: one binding table +
 * a matcher. Keeping the bindings here (instead of scattered `if` checks in
 * App.svelte) makes them unit-testable in one place, and lets the info-popover
 * shortcuts reference (src/lib/shortcuts/shortcuts.ts) render from the same source so
 * the two can't drift.
 */

export type ShortcutAction =
  | "toggle-search"
  | "toggle-settings"
  | "toggle-info"
  | "toggle-view"
  | "new-note"
  | "rename-note"
  | "prev-note"
  | "next-note";

export interface Binding {
  /** Physical key via KeyboardEvent.code — layout-stable, and `Shift+,` stays `Comma`
   *  where `key` would become `<`. */
  code: string;
  /** Exact Shift state required: settings (⌘,) vs prev-note (⌘⇧,) differ only by this. */
  shift: boolean;
  action: ShortcutAction;
}

// Every binding additionally requires (metaKey || ctrlKey) and NOT altKey.
export const BINDINGS: readonly Binding[] = [
  { code: "Slash", shift: false, action: "toggle-search" },
  { code: "KeyE", shift: true, action: "toggle-view" },
  { code: "Comma", shift: false, action: "toggle-settings" },
  { code: "Period", shift: false, action: "toggle-info" },
  { code: "KeyA", shift: true, action: "new-note" },
  { code: "KeyR", shift: true, action: "rename-note" },
  { code: "Comma", shift: true, action: "prev-note" },
  { code: "Period", shift: true, action: "next-note" },
];

/** Resolve a keydown to one of our actions, or null if it isn't a mapped shortcut. */
export function matchShortcut(
  e: Pick<KeyboardEvent, "code" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey">,
): ShortcutAction | null {
  // Our modifier is ⌘ or Ctrl (either); Alt is never part of a binding, and its
  // presence signals a different combo (macOS caret moves / character composition).
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  const binding = BINDINGS.find((b) => b.code === e.code && b.shift === e.shiftKey);
  return binding?.action ?? null;
}
