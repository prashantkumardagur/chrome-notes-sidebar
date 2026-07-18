# Organize notes: sort field + manual reorder

> Roadmap items (Deferred): "Reorder notes" and "Sort notes". This single spec covers **both** — they
> share one surface, so they ship as one cohesive feature (may be staged into two PRs; see How). Its
> own branch.

## Why?

The notes dropdown lists notes in **index order**, which today is just creation order — there's no way
to reorder them or to sort by anything. As a user accumulates notes (up to the max of 10), the ability
to (a) pin the important ones to the top by hand and (b) flip to an automatic order like "most
recently edited" or "A–Z" makes the list navigable instead of a fixed pile. This gives both: a manual
custom order *and* selectable auto-sort.

## What?

When done, the notes dropdown gains an **"Organize notes"** entry (just above "New note", below the
separator). Opening it replaces the editor area with a dedicated **Organize surface** (modeled on the
existing search page) containing:

- **Top:** a **sort-field selector** with three options — **Manual** (custom order), **Title (A–Z)**,
  **Last edited (newest first)**.
- **Below:** the **note list** in the current order. In **Manual** mode the rows are **reorderable**
  by drag-and-drop *and* keyboard; in an auto-sort mode the rows are **locked** (not draggable) and the
  order is derived from the field.
- **Bottom:** a muted **controls help block** describing the mouse and keyboard controls.

Ordering behavior:

- The chosen sort field is **persisted** (synced) so it survives reopen and follows the user's devices.
- **Auto-sort rewrites the stored order** (`notes:index`): while an auto-sort field is active, the app
  keeps the index sorted by that field, re-applying after changes that affect it (a rename affects
  Title; an edit affects Last edited). There is no separate hidden manual order — there is one order.
- **Manual reorder edits `notes:index`** directly and persists immediately.
- The **notes dropdown reflects the same order** (it already renders `notes:index`).

**Keyboard controls in the list (Manual mode):**
- **Up / Down** — move the selection/focus between rows (navigate).
- **Shift+Up / Shift+Down** — move the **focused note** up/down one position (reorder).

**In scope:** a `sortMode` setting + normalization; a pure sort util; a `reorder` repository method; a
new `organize` surface component wired through the single-active-surface coordinator; the dropdown
entry; drag + keyboard reordering; the help block; re-applying auto-sort after mutations; docs + tests.

**Out of scope:** sort by created date (dropped — would require adding `createdAt` to `NoteMeta`);
ascending/descending toggles per field (Title is A–Z, Last edited is newest-first, fixed); multi-level
sort; grouping/folders/tags; pinning as a separate concept (that's a different roadmap item).

## Decisions

Locked during specification. Do not relitigate:

- **One surface, both jobs.** Sort field on top, reorderable list below, in a dedicated page like
  search. Rationale: the user's design unifies sort + reorder into one page; splitting them would cut a
  single surface in half.
- **Three sort fields: Manual, Title (A–Z), Last edited (newest first).** Rationale: `title` and
  `updatedAt` are already in `NoteMeta`, so no index-shape change is needed. Created-date sort was
  explicitly dropped to avoid adding `createdAt` to the index.
- **Auto-sort rewrites `notes:index`** (not display-only). Rationale: user's explicit choice — one
  canonical order; simpler mental model; the trade-off (no preserved manual order after auto-sorting)
  is accepted.
- **`sortMode` lives in `Settings` (`chrome.storage.sync`).** Rationale: it's a genuine preference;
  reuse the settings seam (no new storage area). Default `manual` = today's behavior.
- **Reorder works by drag-and-drop AND keyboard**; Up/Down navigate, Shift+Up/Down move. A muted
  help block documents both. Rationale: user's spec; keyboard path keeps it accessible in a narrow
  panel where dragging is fiddly.
- **The Organize page is a mutually-exclusive surface** (`organize`) coordinated by
  `src/lib/ui/surfaces.ts`, exactly like `search`. Rationale: only one transient surface open at a
  time is an existing invariant.
- **Entry point is a dropdown menu item above "New note", below the separator.** Rationale: user's
  spec; contextual with the list it orders.

## How?

The work splits cleanly and **may be staged into two PRs** on the branch: (1) sort field + surface
scaffold + auto-sort; (2) manual drag/keyboard reorder. Keep them coherent if squashed together.

### 1. `src/lib/settings/settings.ts` — the sort preference

- Add `export type SortMode = "manual" | "title" | "updated";`
- Add `sortMode?: SortMode` to `Settings` (optional; absence = `manual`). Default stays
  `{ theme: "system", view: "persistent" }` (omit `sortMode` when manual to keep stored objects clean,
  mirroring how `lastNoteId` is handled).
- In `normalizeSettings`, carry a valid `sortMode` through, else omit. Keep existing exact-shape tests
  green (see Caveats).

### 2. `src/lib/notes/sort.ts` (new, pure)

```ts
import type { NoteMeta } from "../storage/NotesRepository";
import type { SortMode } from "../settings/settings";

/** Return metas ordered for a sort mode. `manual` returns the input order unchanged. */
export function sortNotes(notes: NoteMeta[], mode: SortMode): NoteMeta[];
```

- `title`: case-insensitive locale compare on `title` (stable). `updated`: `updatedAt` descending.
  `manual`: return a copy in the given order. Never mutate the input.

### 3. `src/lib/storage/NotesRepository.ts` + `SyncNotesRepository.ts` — reorder

- Add to the interface: `reorder(orderedIds: string[]): Promise<void>;` — "Reorder the index to match
  `orderedIds` (ids not present are dropped; unknown ids ignored)."
- Implement in `SyncNotesRepository`: read the index, reorder its metas to follow `orderedIds`
  (filter/lookup by id), and `writeIndex(next)`. Do **not** touch the `note:<id>` items — order lives
  only in the index. Ignore ids that aren't in the current index; keep any index metas missing from
  `orderedIds` appended in their existing relative order (defensive).

### 4. `src/lib/ui/surfaces.ts` — new surface

- Extend the union: `export type Surface = "dropdown" | "settings" | "info" | "search" | "organize";`
  `nextSurface` needs no other change (it's generic over the union).

### 5. `src/components/OrganizeNotes.svelte` (new surface component)

- Props: `notes: NoteMeta[]`, `sortMode: SortMode`, `onSortModeChange(mode)`, `onReorder(ids)`,
  `onClose()`. Structurally mirror `SearchPanel.svelte` (full-height page that replaces the editor).
- **Sort selector** at top (segmented control / radio group): Manual / Title (A–Z) / Last edited.
  Changing it calls `onSortModeChange`.
- **List:** render `notes` (already in display order) as rows. In `manual` mode each row is
  `draggable`, has a drag handle, and is keyboard-operable; in auto modes rows are inert (locked),
  visibly non-draggable.
  - **Drag:** native HTML5 DnD (`dragstart`/`dragover`/`drop`) computing the new id order, then
    `onReorder(newIds)`.
  - **Keyboard:** roving focus across rows; `ArrowUp/Down` move focus; `Shift+ArrowUp/Down` move the
    focused note one slot and call `onReorder`, keeping focus on the moved note. `preventDefault` on the
    handled keys.
- **Help block** at the bottom in `--text-muted`: e.g. "Drag to reorder · ↑/↓ to move between notes ·
  Shift+↑/↓ to move a note". Only meaningful in Manual mode (dim or note "locked while sorting by …" in
  auto modes).
- Themed with existing tokens; visible focus rings; `aria` roles for the list/options.

### 6. `src/components/NoteSelector.svelte` — entry point

- In the open menu, between the `.sep` and the `.footer`'s "New note", add an **"Organize notes"**
  button that calls a new `onOrganize` prop (and closes the dropdown), following the existing item
  styling.

### 7. `src/sidepanel/App.svelte` — wiring

- Add `organize` handling like `search`: `const organizing = $derived(activeSurface === 'organize')`;
  render `<OrganizeNotes .../>` in `.content` when active (a branch alongside the `searching` /
  `mode === 'edit'` branches); `toggleOrganize`/`openOrganize`/`closeOrganize` via `setSurface`.
- Hold `sortMode` from `settings`. When it is not `manual`, **keep the index sorted**: after load and
  after any mutation affecting order (`createNote`, `renameNote`, `persistCurrent`/save, `deleteNote`,
  `importBackup`), compute `sortNotes(notes, sortMode)` and, if the id order differs, call
  `repo.reorder(ids)` then `refreshList()`. Changing `sortMode` to an auto field triggers an immediate
  re-sort; changing to `manual` leaves the current order as-is.
- `onReorder(ids)` (from the surface, manual mode) → `await repo.reorder(ids); await refreshList();`.
- `onSortModeChange(mode)` → `saveSettings({ ...settings, sortMode: mode })` (omit when manual), then
  apply the sort as above.

### 8. Docs

- `docs/architecture.md`: add `OrganizeNotes.svelte`, `src/lib/notes/sort.ts`, the `reorder` repo
  method, and the new `organize` surface to the map + surface list; note `settings` now holds
  `sortMode`.
- `docs/overview.md`: mention sortable/reorderable notes.
- `docs/decisions.md`: a row for auto-sort rewriting the index + sortMode in synced settings.
- `docs/roadmap/index.md`: remove **both** "Reorder notes" and "Sort notes" from Deferred.

## Caveats

- **Keep `normalizeSettings` exact-shape tests green.** `tests/settings/settings.spec.ts` asserts
  `toEqual({ theme, view })` for inputs without extras. Omit `sortMode` when it's `manual`/absent (as
  with `lastNoteId`) so those assertions still pass.
- **Auto-sort + open note can reorder under you.** In "Last edited" mode, saving the current note bumps
  it to the top — expected (like Keep/Tasks), but make sure the currently-open note stays *selected*
  (selection is by id, not position, so this is fine) and that the re-sort doesn't fight the 3s
  autosave (re-sort after the save completes, using the metas from `refreshList`).
- **Don't over-write the index.** Only call `reorder` when the computed order actually differs from the
  current index order, or you'll burn sync writes on every save. Compare id arrays first.
- **Reorder must not corrupt on a stale id set.** If `orderedIds` and the live index disagree
  (a note created/deleted in another surface), `reorder` must drop unknown ids and keep unlisted index
  metas rather than lose a note. Cover with a test.
- **Manual order is not preserved across an auto-sort** (by decision). A reviewer may flag this as data
  loss; it isn't — it's the chosen model (one canonical order).
- **Single active surface.** Opening Organize must close search/dropdown/etc. via `setSurface`;
  opening it should also flush any pending edit (`commitPending`) like `openSearch` does, so a rename
  in flight is reflected in the Title sort.
- **Accessibility.** Drag-only would exclude keyboard users; the Shift+Arrow path is required, with
  focus management and `aria` on the reorderable list. Verify both light/dark.
- **Backup compatibility.** `buildBackup`/`parseBackup` carry `settings`; `sortMode` rides along like
  other fields and normalizes on import — no backup code change, but confirm an imported unknown
  `sortMode` falls back to manual.

## Relevant tests

Pure logic is unit-tested; the surface + wiring is verified by manual E2E.

**New `tests/notes/sort.spec.ts`** (`sortNotes`):
- `manual` returns the input order (a copy, input unmutated).
- `title` sorts case-insensitively (`"apple" < "Banana" < "cherry"`), stable for equal titles.
- `updated` sorts by `updatedAt` descending.

**New `tests/storage/SyncNotesRepository.reorder.spec.ts`** (or extend the existing repo spec):
- `reorder` rewrites `notes:index` to match `orderedIds` and leaves `note:<id>` items untouched.
- Unknown ids in `orderedIds` are ignored; index metas missing from `orderedIds` are kept (appended),
  so no note is lost.

**Extend `tests/settings/settings.spec.ts`:**
- A valid `sortMode` (`"title"`/`"updated"`) is carried through; `"manual"`/invalid/absent yields no
  `sortMode` key; existing `toEqual({theme,view})` cases still pass.

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked):**
1. Open the dropdown → "Organize notes" appears above "New note"; click it → the Organize page opens
   (search/editor closed).
2. Manual mode: drag a note to the top → order changes; close & reopen the panel → order persists; the
   dropdown shows the same order.
3. Manual mode keyboard: focus a row, `Shift+↓` moves it down one slot; `↑/↓` moves focus only.
4. Switch to **Title (A–Z)** → list reorders alphabetically and rows lock (not draggable); the dropdown
   matches. Rename a note so its alphabetical position changes → it moves.
5. Switch to **Last edited** → most recently edited on top; edit a different note, return → it jumps to
   the top.
6. Switch back to **Manual** → rows draggable again; the last order is retained until you drag.
7. The muted help block shows the mouse/keyboard controls; UI correct in light and dark.
