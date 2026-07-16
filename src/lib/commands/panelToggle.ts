/**
 * Keyboard-command handling for toggling the side panel open/closed.
 *
 * Chrome has no `sidePanel.close()` you can call from the background, so a
 * single shortcut toggling both ways needs two cooperating pieces:
 *   - each open panel document holds a long-lived port to the background, and
 *     `PanelRegistry` tracks those ports per window — that's how we know whether
 *     the panel is open in the window a command fired from;
 *   - opening uses `sidePanel.open` (needs the user gesture), closing signals
 *     the panel's port so the document closes *itself* via `window.close()`.
 *
 * The decision logic is kept pure (DI'd over a minimal opener + the registry) so
 * it can be unit-tested without the `chrome` globals; `background.ts` wires it to
 * the real `chrome.commands` / `chrome.sidePanel` / `chrome.runtime` APIs and
 * `src/sidepanel/main.ts` owns the panel side of the port.
 */

/**
 * Manifest command id for the toggle shortcut. The value stays `"open-panel"`
 * for back-compat: Chrome keys user-customized shortcuts by command id, so
 * renaming it would silently reset anyone's rebound key.
 */
export const TOGGLE_PANEL_COMMAND = "open-panel";

/** `port.name` the panel connects with; the background filters on it. */
export const PANEL_PORT_NAME = "sidepanel";

/** Message the background sends over the port to make the panel close itself. */
export const CLOSE_PANEL_MESSAGE = { type: "close-panel" } as const;

/** The single `chrome.sidePanel` capability we depend on (for testability). */
export interface PanelOpener {
  open(options: { windowId: number }): Promise<void>;
}

/** The slice of a connected panel port we use to signal a close. */
export interface PanelPort {
  postMessage(message: unknown): void;
}

/**
 * Tracks which windows currently have the panel open, keyed by the port the
 * panel document connected with. Pure (no `chrome` globals) so it's unit-testable.
 */
export class PanelRegistry {
  private readonly ports = new Map<number, PanelPort>();

  /** Record that the panel is open in `windowId`, reachable via `port`. */
  register(windowId: number, port: PanelPort): void {
    this.ports.set(windowId, port);
  }

  /** Forget the panel in `windowId` (its document closed / port disconnected). */
  unregister(windowId: number): void {
    this.ports.delete(windowId);
  }

  isOpen(windowId: number): boolean {
    return this.ports.has(windowId);
  }

  /** Signal the panel in `windowId` to close itself; no-op if it isn't open. */
  close(windowId: number): void {
    this.ports.get(windowId)?.postMessage(CLOSE_PANEL_MESSAGE);
  }
}

/**
 * Toggle the side panel in the window the shortcut fired from: open it if it's
 * closed, close it if it's open. Ignores unrelated commands and no-ops when no
 * window is known.
 *
 * Must be called synchronously from the `onCommand` handler: `sidePanel.open`
 * requires a user gesture, so we decide from the in-memory registry and read
 * `windowId` off the event's `tab` rather than awaiting a lookup (which would
 * drop the gesture).
 */
export function togglePanelForCommand(
  command: string,
  tab: chrome.tabs.Tab | undefined,
  panel: PanelOpener,
  registry: PanelRegistry,
): void {
  if (command !== TOGGLE_PANEL_COMMAND) return;
  const windowId = tab?.windowId;
  if (windowId === undefined) return;

  if (registry.isOpen(windowId)) {
    registry.close(windowId);
  } else {
    panel.open({ windowId }).catch((err) => console.error("Failed to open side panel:", err));
  }
}

/** The panel's side of the port (a `chrome.runtime.Port` slice, for testability). */
export interface PanelClientPort {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (message: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

/** Dependencies the panel-side connector needs, injected so it's unit-testable. */
export interface PanelClientDeps {
  /** Open a fresh port to the background (a `chrome.runtime.connect` wrapper). */
  connect(): PanelClientPort;
  /** The id of the window hosting this panel, or undefined if unknown. */
  getWindowId(): Promise<number | undefined>;
  /** Close this panel document (a `window.close` wrapper). */
  close(): void;
}

/**
 * Connect this panel document to the background so the toggle shortcut can find
 * and close it. Reports the host window id over the port and closes the document
 * when the background asks. Reconnects if the connection drops while the panel is
 * still alive (e.g. the service worker restarted) to keep tracking accurate.
 */
export async function connectPanelToBackground(deps: PanelClientDeps): Promise<void> {
  const windowId = await deps.getWindowId();
  if (windowId === undefined) return;

  const wire = (): void => {
    const port = deps.connect();
    port.postMessage({ windowId });
    port.onMessage.addListener((message) => {
      if ((message as { type?: string })?.type === CLOSE_PANEL_MESSAGE.type) deps.close();
    });
    // A disconnect while the panel is still open means the worker went away, not
    // that we're closing — re-establish so `isOpen` stays correct.
    port.onDisconnect.addListener(() => wire());
  };
  wire();
}
