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
| Oversized save is **blocked and surfaced**, not silently failed | Avoids data-loss surprises when a note can't fit a sync item. |

## Tech & tooling
| Decision | Why |
|---|---|
| **Svelte 5 + Vite 8 + CRXJS** | Small/fast UI; CRXJS handles MV3 manifest + HMR. |
| **`NotesRepository` seam** (only file touching `chrome.storage`) | Backend swap (local/cloud) becomes a one-file change. |
| **Biome**, recommended rules, 2-space / 120-width | One fast tool for lint + format; `.svelte` left to svelte-check. |
| **Vitest**, one spec per meaningful function | Fast unit coverage of pure logic; components covered by manual E2E. |
| Load-unpacked now, stay **MV3-publishable** | Ship immediately; keep the door open to the Web Store. |

## Process
| Decision | Why |
|---|---|
| **Small PRs, squash-only merges** | Coherent history; each PR = one reviewable unit. |
| **PR-only `main`** (by discipline) | Branch protection needs a paid plan on this private repo; enforced by convention instead. |
