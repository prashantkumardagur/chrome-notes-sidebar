/**
 * Background service worker.
 *
 * Opens the side panel two ways: clicking the toolbar icon, and the keyboard
 * shortcut registered under `commands` in the manifest.
 */

import { openPanelForCommand } from "./lib/commands/openPanel";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error("Failed to set side panel behavior:", err));
});

// The shortcut: open the panel in the window it fired from. `sidePanel.open`
// needs the command's user gesture, so we call it synchronously (no awaits).
chrome.commands.onCommand.addListener((command, tab) => {
  openPanelForCommand(command, tab, chrome.sidePanel);
});
