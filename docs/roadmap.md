# Roadmap

One task = one PR (see the workflow in [CLAUDE.md](../CLAUDE.md)). PR 1 was intentionally larger.

## Shipped
- **PR 1 — Scaffold + side panel + edit.** Vite/Svelte/TS/CRXJS MV3 scaffold; single-note
  Edit/View; 3s debounced autosave to `chrome.storage.sync`; `NotesRepository` seam.
- **PR 2 — Multi-note + Biome.** `notes:index` model; selector create/select/rename/delete;
  `MAX_NOTES=10` with `used/10`; Biome lint/format.
- **PR 3 — Character budget & save status.** `CharCounter` (`used/limit`), block/warn near cap;
  save-state dot (Saving/Saved) as the counter separator. *(in review)*

## Next
- **PR 4 — Utility bar (bottom-left).** Copy-all-text; info popover (last updated, char/note count).
- **PR 5 — Dark mode / theme.** CSS-var tokens; follow OS `prefers-color-scheme`; persisted toggle.
- **PR 6 — Keyboard shortcut.** `commands` in manifest; background `sidePanel.open({ windowId })`.

## Deferred
Export / import (`.md`/`.json`), search, TTS, password lock, and the Web Store publish package
(final icons, screenshots, description, privacy policy).
