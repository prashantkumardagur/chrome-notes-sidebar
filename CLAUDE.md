# CLAUDE.md — Agent onboarding & conventions

Instructions for any agent (or human) picking up work on this repo. Read this **and** `plan.md`
(the roadmap / source of truth for scope and the PR breakdown) before starting.

## What this is

A Chrome MV3 extension that puts a **Markdown notes editor in the browser side panel**
(`chrome.sidePanel`). Notes sync across the user's own Chrome browsers via `chrome.storage.sync` —
**no account, no cloud backend of ours**. Interaction model = Google Tasks, but for notes:
a note dropdown + a View/Edit tab switch at the top.

## Golden rules

1. **Small, PR-sized changes.** One task from `plan.md` = one PR. Do not bundle unrelated work.
   PR 1 is the only intentionally larger one (scaffold). Follow the PR order in `plan.md`.
2. **Every meaningful function is unit-tested.** Tests live in `tests/` (mirroring `src/`), run
   with Vitest. A PR is not done until `npm test` is green and new logic is covered. Pure logic is
   unit-tested; Svelte components are checked via the manual E2E steps in `plan.md`.
3. **All persistence goes through `NotesRepository`.** `src/lib/storage/SyncNotesRepository.ts` is
   the *only* file allowed to touch `chrome.storage.*`. This seam is what lets us swap backends
   later — keep UI/stores backend-agnostic.
4. **Respect the storage caps.** `chrome.storage.sync`: ~100 KB total, ~8 KB/item, 120 writes/min.
   Hence: **max 10 notes**, a **per-note char budget**, and **3-second debounced** saves. All
   cap/byte logic lives in `src/lib/storage/limits.ts`.
5. **Render Markdown safely.** `src/lib/markdown/render.ts` renders **GFM** and MUST sanitize
   output (DOMPurify) — note content is untrusted. Never inject raw HTML elsewhere.
6. **Keep it store-publishable.** We ship load-unpacked today but may publish to the Chrome Web
   Store later — avoid broad permissions, remote code, or anything that fails MV3 review.

## Layout contract (don't drift from this)

- **Top:** note selector (left) + View / Edit tabs.
- **Middle:** Markdown textarea (Edit) or rendered GFM (View).
- **Bottom-left:** tools (copy-all, info popover).
- **Bottom-right:** character counter (used / limit).

## Project layout

See the tree in `plan.md`. Entry points: `src/background.ts` (service worker),
`src/sidepanel/` (the panel UI). Shared logic in `src/lib/`, components in `src/components/`.

## Commands

- `npm run dev` — Vite dev build with HMR.
- `npm run build` — production build into `dist/` (this is what you Load unpacked).
- `npm test` — run Vitest once. `npm run test:watch` for watch mode.
- Lint/format: **Biome** — added in PR 2 (`npm run lint`, `npm run format`).

## Load the extension

`npm run build` → open `chrome://extensions` → enable Developer mode → **Load unpacked** →
select the `dist/` folder → click the toolbar icon to open the side panel.

## Roadmap

Full scope, decisions, and the ordered PR plan are in **`plan.md`**. Update it if scope changes.
