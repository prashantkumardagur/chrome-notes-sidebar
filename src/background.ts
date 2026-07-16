/**
 * Background service worker.
 *
 * Opens the side panel two ways: clicking the toolbar icon, and the keyboard
 * shortcut registered under `commands` in the manifest. The shortcut *toggles* —
 * it also closes the panel — which Chrome has no direct API for, so each open
 * panel document holds a port here (see `panelToggle.ts`) and we track those in
 * a `PanelRegistry` to know whether a window's panel is open.
 */

import { PANEL_PORT_NAME, PanelRegistry, togglePanelForCommand } from "./lib/commands/panelToggle";

const panels = new PanelRegistry();

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error("Failed to set side panel behavior:", err));
});

// Each panel document connects on load and reports its window id; the connection
// dropping (panel closed, or the worker restarting) is how we learn it's gone.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PANEL_PORT_NAME) return;
  let windowId: number | undefined;
  port.onMessage.addListener((msg: { windowId?: number }) => {
    if (typeof msg?.windowId === "number") {
      windowId = msg.windowId;
      panels.register(windowId, port);
    }
  });
  port.onDisconnect.addListener(() => {
    if (windowId !== undefined) panels.unregister(windowId);
  });
});

// The shortcut: toggle the panel in the window it fired from. `sidePanel.open`
// needs the command's user gesture, so we decide from the in-memory registry and
// call open synchronously (no awaits).
chrome.commands.onCommand.addListener((command, tab) => {
  togglePanelForCommand(command, tab, chrome.sidePanel, panels);
});
