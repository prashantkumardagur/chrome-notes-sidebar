/**
 * Background service worker.
 *
 * For now its only job is to make the toolbar icon open the side panel.
 * A keyboard-shortcut handler (commands API) will be added in a later PR.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('Failed to set side panel behavior:', err));
});
