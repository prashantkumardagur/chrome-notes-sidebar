# Decisions

Key choices and the reasoning. Terse on purpose — code is the source of truth for *how*.

## Product & storage
| Decision | Why |
|---|---|
| **Side panel** (`chrome.sidePanel`) | Persists across tab navigation, unlike a popup. |
| **`chrome.storage.sync`**, no backend/account | Free cross-device sync; keeps us serverless and private. |
| **Max 10 notes**; **per-note char budget**; **3s debounced** saves | `storage.sync` caps: ~100 KB total, ~8 KB/item, 120 writes/min. 10×8 KB + index < 100 KB; debounce stays under the write-rate limit. |
| One `note:<id>` item each + a `notes:index` item | Keeps each note under the 8 KB item cap; index stays tiny. |
| **`MAX_NOTE_CHARS = 7500`** (under the ~7680 B body budget) | Safe for ASCII; multi-byte text is additionally guarded by a byte check (`bodyFitsStorage`). |
| **GFM, always sanitized** (`marked` + `DOMPurify`) | Familiar markdown; note content is untrusted → must sanitize before render. |
| **Raw HTML in notes renders as literal text** (escaped in a `marked` `html` renderer override) | Predictable rendering + defense-in-depth; Markdown-generated HTML (headings, tables, task lists, md images) is unaffected, and DOMPurify stays to sanitize that Markdown output (e.g. `javascript:` links). |
| Oversized save is **blocked and surfaced**, not silently failed | Avoids data-loss surprises when a note can't fit a sync item. |
| **Sort field (`sortMode`) in synced settings**; **auto-sort rewrites `notes:index`** (not display-only) | One canonical order across the dropdown + Organize page, following the user's devices. Manual is the default (omitted when stored). Auto fields (`title`/`updated`) re-apply after any order-affecting mutation; trade-off (no preserved manual order after auto-sorting) is accepted for a simpler mental model. Reorder writes only when the order actually differs, to respect the sync write-rate limit. |

## Tech & tooling
| Decision | Why |
|---|---|
| **Svelte 5 + Vite 8 + CRXJS** | Small/fast UI; CRXJS handles MV3 manifest + HMR. |
| **Repository seams** (`NotesRepository`, `SettingsRepository` — the only files touching `chrome.storage`) | Backend swap (local/cloud) becomes a one-file change per domain. |
| **Settings in `storage.sync`** (`{theme, view, lastNoteId?, sortMode?, …}`); theme via `data-theme` on `:root` | Prefs follow the user across devices; a forced `data-theme` overrides `prefers-color-scheme`. `lastNoteId` is a device cursor (last opened note) that reuses the settings item — no new seam; a stale id falls back to `notes[0]`. |
| **Editor prefs** (font size, line spacing, editor font, word wrap) as optional settings fields, applied via `--` CSS vars from a pure `resolveEditorVars` (like `applyTheme`) | Mirrors the theme system: one unit-testable resolver → root vars the components read, no per-component style logic. Prefs are default-omitted (like `lastNoteId`) to keep stored settings clean. Size/spacing apply to Edit + View; font + wrap are Edit-only (View keeps its own typography, code stays monospace). |
| **Keyboard shortcut** via `commands` + `onCommand`; `windowId` read off the event `tab` | `sidePanel.open` needs a user gesture — reading `windowId` synchronously (no `await`) keeps it. |
| **Shortcut *toggles*** — panels hold a port to the worker (`PanelRegistry`); closing signals the panel to `window.close()` itself | Chrome has no `sidePanel.close()`, so open/closed state is tracked via live ports and the panel closes itself on request. |
| **In-panel shortcuts via one keymap** (`shortcuts/keymap.ts`) dispatched by a single window `keydown` listener; match on **`event.code` + exact modifier flags** (⌘\|Ctrl, exact Shift, never Alt) | One testable source of truth that also backs the popover reference. `code` is layout-stable (`Shift+,` stays `Comma`, not `<`); exact Shift disambiguates `⌘,`/`⌘⇧,` (settings vs prev-note). Only `preventDefault` on a match, so the textarea's `⌘A/C/V/X/Z` and toolbar's `⌘B/I/K` pass through. Alt is avoided (macOS char composition / caret moves; Win/Linux menu mnemonics). |
| **Biome**, recommended rules, 2-space / 120-width | One fast tool for lint + format; `.svelte` left to svelte-check. |
| **Vitest**, one spec per meaningful function | Fast unit coverage of pure logic; components covered by manual E2E. |
| Load-unpacked now, stay **MV3-publishable** | Ship immediately; keep the door open to the Web Store. |
| **Bundled `highlight.js` subset** for fenced code — explicit language only, themed via custom `--hl-*` vars | a curated set of grammars (core + per-language imports) keeps the bundle lean; explicit-only is deterministic and avoids auto-detect weight; no remote/CDN (MV3-safe); the token→var map flips with light/dark. |

## Process
| Decision | Why |
|---|---|
| **Small PRs, squash-only merges** | Coherent history; each PR = one reviewable unit. |
| **PR-only `main`** (by discipline) | Branch protection needs a paid plan on this private repo; enforced by convention instead. |
