/**
 * Pure display logic for the "Keyboard shortcuts" reference in the ⓘ info popover.
 * The component supplies the runtime inputs (platform + the live `open-panel`
 * binding from `chrome.commands.getAll()`); this module only formats rows.
 */

export interface ShortcutRow {
  keys: string; // e.g. "⌘⇧Y", "Ctrl+Shift+Y", "⌘+/", "Esc"
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

/**
 * Build the shortcut rows for display. `toggleKey` is the live binding (from
 * chrome.commands.getAll), or null/empty to fall back to defaultToggleLabel.
 */
export function buildShortcutRows(opts: { mac: boolean; toggleKey: string | null }): ShortcutRow[] {
  const { mac, toggleKey } = opts;
  return [
    { keys: toggleKey || defaultToggleLabel(mac), action: "Toggle panel" },
    { keys: `${modifier(mac)}+/`, action: "Search" },
    { keys: "Esc", action: "Close surface" },
  ];
}
