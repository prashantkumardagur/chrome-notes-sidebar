# One transient surface open at a time (single active surface)

> Roadmap item: "Clicking on search should collapse the note selector." During specification the
> scope was deliberately broadened from that one case to a general rule (see **Decisions**). This is
> its own small PR, independent of [last-opened-note.md](./last-opened-note.md).

## Why?

The side panel has several **transient surfaces** that pop open over the UI, and today each one
manages its own open/closed state in isolation. They don't know about each other, so you can end up
with more than one open — or, worse, one that *should* have closed but didn't.

The concrete bug that prompted this: open the **note-selector dropdown** (to eyeball the note list),
then — while it's still open — click the **🔍 search** button. The panel switches to the search page,
but the note dropdown **stays open**, floating (via `position: absolute; z-index: 20`) over the search
results. It reads as broken. The 🔍 button lives *inside* `NoteSelector`'s own root element, so the
dropdown's "close on outside click" handler never fires for it.

The underlying principle the user stated: **"if I change the action, the previous action should close
itself."** Only one of these transient surfaces should be open at any moment. Cross-component surfaces
*accidentally* close each other today via each component's outside-click handler, but that is fragile
and does not cover surfaces that share a root (search vs. dropdown) or the search page (which isn't a
popover with an outside-click handler at all). This task makes "one open at a time" true **by
construction** instead of by accident.

## What?

When done, opening any one of these surfaces closes whichever other one was open — panel-wide, every
time, regardless of which components they live in:

- the **note-selector dropdown** (`NoteSelector.svelte`)
- the **settings** popover (`SettingsMenu.svelte`)
- the **note-info** popover (`UtilityBar.svelte`)
- **search mode** (`App.svelte` — the page that replaces the editor)

Concretely:

- Opening the dropdown while search is on → leaves search and shows the dropdown; opening search while
  the dropdown is open → **closes the dropdown** and shows search (the reported bug).
- Opening settings or info while any of the others is open closes that other one, and vice-versa.
- The existing per-surface dismissals still work: clicking outside a surface, pressing **Escape**, or
  (for the dropdown) picking/creating/renaming a note still closes it. Search still closes on the 🔍
  toggle, on Cmd/Ctrl+`/`, on Escape in the search input, and when a result opens a note.

**In scope:** introducing a single source of truth for "which surface is open" in `App.svelte`,
converting the three popover components to be **controlled** (open state passed in, changes reported
out), routing search mode through the same coordinator, and a tiny pure helper for the state
transition with unit tests.

**Out of scope:** the inline **rename** input in `NoteSelector` (it already commits-on-blur when focus
leaves, so switching actions closes it — leave its behavior as-is). No visual/styling redesign of any
popover. No change to what any popover *contains* or to search behavior/results. No new keyboard
shortcuts.

## Decisions

Locked during specification. Do not relitigate:

- **Broaden the scope to a general "one surface at a time" rule**, rather than only special-casing the
  search-button-vs-dropdown bug. Rationale: the user explicitly wants the principle "changing the
  action closes the previous action" applied panel-wide, and a coordinator is more robust than piling
  up pairwise special cases.
- **App owns a single `activeSurface` state; the popovers become controlled** (Option A of the three
  approaches weighed). Rationale: `App.svelte` already orchestrates almost all panel state (notes,
  editor mode, search snapshot), and the components are already thin. A single source of truth makes
  the invariant hold by construction with no new architectural pattern (no global singleton, no event
  bus). Rejected alternatives: a shared coordinator **singleton module** (adds a stateful global
  pattern the repo doesn't have, plus subscription glue in every component) and a **`window`
  CustomEvent broadcast** (smallest diff but implicit, spread across four listeners, easy to forget to
  wire a future popover into).
- **The state *transition* is a pure function in `src/lib/ui/surfaces.ts`, unit-tested; the reactive
  `$state` stays in `App.svelte`.** Rationale: honors the repo rule "every meaningful pure function is
  unit-tested" without turning the coordinator into a stateful singleton — App still owns the state,
  the helper is just the pure reducer it calls.
- **`search` is part of the mutually-exclusive set** (opening settings/info/dropdown also leaves
  search). Rationale: the user chose full symmetry ("one popover at a time, everywhere"). This is
  non-destructive — the search query and collapsed groups are preserved in `App` state and session
  storage, so re-entering search restores them (`openSearch` re-snapshots the notes).
- **The inline rename input is left out of the coordinated set.** Rationale: it already commits on blur
  when focus leaves, so starting another action closes it; folding it in would add churn for no visible
  gain and is out of scope.

## How?

Follow the repo seams (`docs/architecture.md`): pure logic in `src/lib/` unit-tested under `tests/`;
components stay thin and are verified by manual E2E (`CLAUDE.md`).

### 1. Pure transition helper — `src/lib/ui/surfaces.ts` (new)

```ts
/** The transient surfaces that must be mutually exclusive (only one open at a time). */
export type Surface = "dropdown" | "settings" | "info" | "search";

/**
 * Next open surface after one toggles. Opening a surface closes any other; closing a
 * surface clears the state only if it was the one open (closing an already-closed
 * surface must not stomp whichever surface is currently open).
 */
export function nextSurface(current: Surface | null, id: Surface, open: boolean): Surface | null {
  if (open) return id;
  return current === id ? null : current;
}
```

Add `tests/ui/surfaces.spec.ts` (see **Relevant tests**).

### 2. `src/sidepanel/App.svelte` — own the state, wire the surfaces

- Add `import { type Surface, nextSurface } from '../lib/ui/surfaces';`.
- Add `let activeSurface = $state<Surface | null>(null);`.
- Add a setter used by every controlled surface:
  `function setSurface(id: Surface, open: boolean) { activeSurface = nextSurface(activeSurface, id, open); }`.
- **Search** now derives from `activeSurface` instead of a standalone boolean. Replace
  `let searching = $state(false);` with `const searching = $derived(activeSurface === 'search');`.
  - `openSearch()`: keep the existing flush + snapshot (`commitPending()`, gather full notes into
    `searchNotesData`), then set `activeSurface = 'search';` (instead of `searching = true`). Snapshot
    **before** flipping the surface so the panel never renders without its data.
  - `closeSearch()`: `setSurface('search', false);` (only clears if search was the active surface).
  - `toggleSearch()` stays `searching ? closeSearch() : void openSearch();`.
  - `selectNote()` already calls `closeSearch()` first — unchanged, still correct.
- Pass controlled props to the three popover components (see their contract in step 3):
  - `<NoteSelector open={activeSurface === 'dropdown'} onOpenChange={(o) => setSurface('dropdown', o)} … />`
  - `<SettingsMenu open={activeSurface === 'settings'} onOpenChange={(o) => setSurface('settings', o)} … />`
  - `<UtilityBar open={activeSurface === 'info'} onOpenChange={(o) => setSurface('info', o)} … />`
- The `searchActive={searching}` prop already passed to `NoteSelector` keeps working (it drives the
  pressed style on the 🔍 button); `searching` is now the derived value.

### 3. Controlled-popover contract (apply to all three components)

Each of `NoteSelector.svelte`, `SettingsMenu.svelte`, `UtilityBar.svelte` currently declares
`let open = $state(false)` and its own outside-click/Escape `$effect`. Convert each to:

- **Props:** add `open: boolean` and `onOpenChange: (open: boolean) => void` to the `$props()` type
  (remove the internal `let open = $state(false)`).
- **Toggling from the trigger button:** replace `onclick={() => (open = !open)}` /
  `onclick={toggleMenu}` with `onclick={() => onOpenChange(!open)}`.
- **Self-dismissal:** in the existing outside-click/Escape `$effect` (still gated by `if (!open) return`),
  replace every `open = false` with `onOpenChange(false)`. Keep `bind:this={root}` and the
  inside/outside test — each component still knows its own bounds; it just *reports* the close instead
  of mutating local state.
- **`NoteSelector` specifics:** it has both the dropdown (`open`, now controlled) and the internal
  `editing` (rename, left internal). Update the internal callers that close the dropdown —
  `pick()`, `create()`, `startRename()` currently set `open = false` — to call `onOpenChange(false)`
  instead. `toggleMenu()`'s `if (editing) return` guard stays; its body becomes `onOpenChange(!open)`.
  Leave all rename logic (`editing`, `draft`, `commitRename`, `onblur`) untouched.

Net effect: because `App` renders `open={activeSurface === X}`, opening any surface sets
`activeSurface = X` via `setSurface`, which flips every other surface's `open` prop to `false`, tearing
down its outside-click effect and hiding it — one open at a time, guaranteed.

### 4. Docs

- Add `src/lib/ui/surfaces.ts` to the file map in `docs/architecture.md` (a new `ui/` group:
  "single-active-surface coordination — which transient popover/search page is open").
- Tick / annotate this item in `docs/roadmap/index.md`.

## Caveats

- **Report closes; never mutate `open` locally in the child.** After conversion `open` is a prop —
  assigning to it in a child does nothing useful and desyncs from `App`. Every close must go through
  `onOpenChange(false)`.
- **Don't double-fire on cross-surface clicks.** Clicking surface B's trigger fires surface A's
  outside-click (`onOpenChange(false)` for A) *and* B's toggle (`onOpenChange(true)` for B). That's why
  `nextSurface` guards close with `current === id`: A's close must not clear B after B opened. The
  provided helper handles this; keep its semantics.
- **Snapshot before flipping to search.** `openSearch` is async (it flushes pending autosave and reads
  every note). Set `activeSurface = 'search'` only *after* `searchNotesData` is populated, or the
  search page can render against a stale/empty snapshot. There may be a sub-frame where the dropdown is
  still visible during the `await`; that's acceptable (the reads are local and fast).
- **Leaving search is non-destructive.** Opening another surface sets `searching` false but must not
  clear `searchQuery` / `searchCollapsed` (they persist in `App` state and via
  `SessionSearchStateRepository`). Don't reset them here.
- **Keep `searchActive` truthful.** The 🔍 pressed style reads from `searching`; since it's now derived
  from `activeSurface`, it stays correct automatically — don't reintroduce a separate boolean.
- **Rename is intentionally not coordinated.** Don't try to fold `editing` into `activeSurface`; it
  commits on blur already. Just make sure `startRename` closes the dropdown via `onOpenChange(false)`.
- **Escape still works per surface.** The Escape branch inside each component's `$effect` must call
  `onOpenChange(false)`; the search input's own Escape → `onClose` path in `SearchPanel.svelte` is
  unchanged.

## Relevant tests

Pure logic is unit-tested; the components and the coordination they produce are verified by manual
E2E, per `CLAUDE.md`.

**New unit tests — `tests/ui/surfaces.spec.ts`:**
- `nextSurface(null, 'dropdown', true)` → `'dropdown'` (opening from nothing).
- `nextSurface('dropdown', 'settings', true)` → `'settings'` (opening one closes the other).
- `nextSurface('settings', 'settings', false)` → `null` (closing the active surface clears it).
- `nextSurface('dropdown', 'settings', false)` → `'dropdown'` (closing a **non**-active surface leaves
  the current one — the double-fire guard).
- `nextSurface('search', 'search', false)` → `null` and `nextSurface('search', 'settings', true)` →
  `'settings'` (search participates like any other surface).

**Commands (all must be green):**
```
npm test          # Vitest — new surfaces spec + existing suite
npm run check     # svelte-check — new/changed component props
npm run lint      # Biome
npm run build     # production build into dist/
```

**Manual E2E (load `dist/` unpacked, per `CLAUDE.md` → "Load the extension"):**
1. Open the note dropdown, then click 🔍 → the dropdown closes and the search page shows (the original
   bug is gone).
2. Enter search, then open the note dropdown → search closes, dropdown shows. Re-open search → your
   previous query and collapsed groups are still there.
3. With the dropdown open, click the ⚙ settings gear → dropdown closes, settings opens. With settings
   open, click the ⓘ info button → settings closes, info opens. Never two at once.
4. Open any surface, press **Escape** → it closes. Open any surface, click empty editor space → it
   closes.
5. Open settings while in search mode → search closes (non-destructive: re-entering restores it).
6. Rename a note (✎), then click the gear/info → the rename commits (blur) as before; nothing breaks.
7. Cmd/Ctrl+`/` still toggles search open/closed; the 🔍 button still shows its pressed state while
   search is on.
