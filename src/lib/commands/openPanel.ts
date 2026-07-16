/**
 * Keyboard-command handling for opening the side panel.
 *
 * The decision logic is kept pure (and DI'd over a minimal panel opener) so it
 * can be unit-tested without the `chrome` globals; `background.ts` wires it to
 * the real `chrome.commands` / `chrome.sidePanel` APIs.
 */

/** Manifest command id for the "open the panel" shortcut. */
export const OPEN_PANEL_COMMAND = "open-panel";

/** The single `chrome.sidePanel` capability we depend on (for testability). */
export interface PanelOpener {
  open(options: { windowId: number }): Promise<void>;
}

/**
 * Open the side panel in the window the shortcut fired from. Ignores unrelated
 * commands and no-ops when no window is known.
 *
 * Must be called synchronously from the `onCommand` handler: `sidePanel.open`
 * requires a user gesture, and we read `windowId` off the event's `tab` rather
 * than awaiting a lookup (which would drop the gesture).
 */
export function openPanelForCommand(command: string, tab: chrome.tabs.Tab | undefined, panel: PanelOpener): void {
  if (command !== OPEN_PANEL_COMMAND) return;
  const windowId = tab?.windowId;
  if (windowId === undefined) return;
  panel.open({ windowId }).catch((err) => console.error("Failed to open side panel:", err));
}
