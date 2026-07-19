/**
 * Pure display logic for the "Keyboard shortcuts" reference in the ⓘ info popover.
 * The in-panel rows are rendered from the same keymap that dispatches them
 * (src/lib/shortcuts/keymap.ts) so the reference can't drift from the real bindings;
 * the component supplies the runtime inputs (platform + the live `open-panel` binding
 * from `chrome.commands.getAll()`).
 */

import { BINDINGS, type ShortcutAction } from "./keymap";

export interface ShortcutRow {
  keys: string; // e.g. "⌘⇧Y", "Ctrl+Shift+Y", "⌘/", "Esc"
  action: string; // e.g. "Toggle panel", "Search", "Close surface"
}

/** Default label for the open-panel command when no live binding is available. */
export function defaultToggleLabel(mac: boolean): string {
  return mac ? "⌘⇧Y" : "Ctrl+Shift+Y";
}

/** `⌘` on macOS, `Ctrl` elsewhere — kept in one place so app-level rows stay consistent. */
function modifier(mac: boolean): string {
  return mac ? "⌘" : "Ctrl";
}

/** Human-readable action label per keymap action, shown in the reference. */
const ACTION_LABELS: Record<ShortcutAction, string> = {
  "toggle-search": "Search",
  "toggle-view": "Toggle Edit/View",
  "toggle-settings": "Settings",
  "toggle-info": "Info",
  "new-note": "New note",
  "rename-note": "Rename note",
  "delete-note": "Delete note",
  "prev-note": "Previous note",
  "next-note": "Next note",
};

/** Display glyph for each bound physical key (KeyboardEvent.code). */
const KEY_LABELS: Record<string, string> = {
  Slash: "/",
  KeyE: "E",
  Comma: ",",
  Period: ".",
  KeyA: "A",
  KeyR: "R",
  Backspace: "⌫",
};

/** Format one keymap binding as a display chip: "⌘⇧E" on mac, "Ctrl+Shift+E" elsewhere. */
function formatBinding(mac: boolean, code: string, shift: boolean): string {
  const key = KEY_LABELS[code] ?? code;
  if (mac) return `${modifier(true)}${shift ? "⇧" : ""}${key}`;
  return `${modifier(false)}+${shift ? "Shift+" : ""}${key}`;
}

/**
 * Build the shortcut rows for display. `toggleKey` is the live binding (from
 * chrome.commands.getAll), or null/empty to fall back to defaultToggleLabel.
 */
export function buildShortcutRows(opts: { mac: boolean; toggleKey: string | null }): ShortcutRow[] {
  const { mac, toggleKey } = opts;
  return [
    { keys: toggleKey || defaultToggleLabel(mac), action: "Toggle panel" },
    ...BINDINGS.map((b) => ({
      keys: formatBinding(mac, b.code, b.shift),
      action: ACTION_LABELS[b.action],
    })),
    { keys: "Esc", action: "Close surface" },
  ];
}
