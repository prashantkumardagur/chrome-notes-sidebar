# Revamp settings: popover → dedicated page

> New roadmap item. Its own small PR. **Foundational:** any task that adds or changes controls in the
> settings UI should build on top of this (see the dependency notes in
> [roadmap/index.md](./index.md)).

## Why?

Settings today live in a cramped **popover** anchored to the gear button in the footer
(`SettingsMenu.svelte`): Theme, "View on note switch", and Backup (export/import) are squeezed into a
`min-width: 200px` floating box that opens upward. As settings grow (editor preferences —
font size, spacing, font, word-wrap — and potentially more), the popover becomes a poor container:
tight, easy to dismiss by an outside click mid-interaction, and awkward to scroll. The app already has
a clean pattern for a **full surface that replaces the editor area** — the search page (`SearchPanel`)
and the planned organize page — coordinated by the single-active-surface mechanism. Moving settings to
that same kind of **dedicated page** gives it room to breathe, a stable place to grow, and a consistent
interaction model with search/organize.

## What?

When done, clicking the footer **gear** opens a **full-page Settings surface** in the content area
(replacing the editor/view), instead of a floating popover. The page:

- Has a **header with a title ("Settings") and a close/back control**, mirroring the search page's
  header/close affordance; **Escape** and the close button return to the editor.
- Contains the **existing settings, unchanged in behavior**, laid out as vertical sections: **Theme**,
  **View on note switch**, **Backup** (Export / Import, including the hidden file input, the
  confirm-before-import, and the status message).
- Is a **mutually-exclusive surface** (`settings`) — opening it closes search/organize/dropdown/info,
  and opening any of those closes it (reusing the existing `nextSurface` coordinator; the `settings`
  surface id already exists, currently driving the popover's open state).
- Opening it **flushes any pending autosave** first (like `openSearch`), so nothing is lost when the
  editor is swapped out.

**In scope:** converting the settings popover into a page component rendered in `.content`; the
header/close; wiring `activeSurface === 'settings'` to render the page instead of a popover; keeping
the gear button as the trigger; preserving all current settings behavior and the outside/Escape-close
semantics adapted to a page; docs.

**Out of scope:** adding *new* settings (editor preferences etc. are their own tasks that build on this
page); changing the settings data model / `normalizeSettings`; changing backup format or logic;
restyling beyond what the page layout requires; moving the gear button itself out of the footer.

## Decisions

Locked during specification. Do not relitigate:

- **Settings becomes a full page like search/organize, not a popover.** Rationale: user's directive;
  room to grow, consistent surface model, no fragile floating box.
- **Reuse the existing `settings` surface id** in `src/lib/ui/surfaces.ts` — no union change needed (it
  already exists, presently used to mean "popover open"; it now means "settings page open"). Rationale:
  the coordination semantics are identical; only the rendered thing changes from a popover to a page.
- **Keep the footer gear as the entry point**, toggling the settings surface. Rationale: it's the
  established, discoverable control; only what it opens changes.
- **Preserve all current settings behavior verbatim** (theme, view-on-switch, backup export/import,
  confirm-on-import, status message). Rationale: this is a container/layout move, not a behavior
  change; keep the diff about *where* settings render.
- **Match the search page's structure** (a header row with title + close, a scrollable body). Rationale:
  visual/interaction consistency with the other full-page surfaces; reuse the layout contract.

## How?

### 1. `src/components/SettingsMenu.svelte` → a page

Turn the popover into a page surface. Two viable shapes — pick one, keep it clean:
- **(preferred)** Rename/refactor into `SettingsPanel.svelte` (a content-area surface, sibling to
  `SearchPanel.svelte`/the planned `OrganizeNotes.svelte`), and keep the **gear trigger button** either
  in `UtilityBar`/footer where it is today or as a tiny standalone control that calls `onOpen`. Move the
  fieldset markup (Theme, View, Backup) into the page body; add a header (`Settings` + a close button
  like search) and a scrollable content region.
- Or keep the component name but replace the `{#if open}` *popover* with rendering handled by `App`
  in `.content` (less clean — prefer the dedicated page component).
- The trigger no longer needs `aria-haspopup="dialog"`/popover semantics; it toggles the page. Drop the
  popover's outside-`pointerdown`-to-close effect; the page closes via its header button / Escape / by
  opening another surface (the `setSurface` coordinator handles mutual exclusion).
- Preserve: the `THEME_OPTIONS`/`VIEW_OPTIONS` segmented controls, `setTheme`/`setView`, `handleExport`
  (Blob download), `triggerImport`/`handleFileSelected` (hidden `<input type=file>`, the
  `confirm(...)`, and the `importMessage` status line). These move into the page unchanged.

### 2. `src/sidepanel/App.svelte` — render the page, not a popover

- Add `const showSettings = $derived(activeSurface === 'settings')` and render `<SettingsPanel .../>` in
  the `.content` block alongside the `searching` / `mode` branches (e.g. `{#if searching}…{:else if
  showSettings}<SettingsPanel .../>{:else if mode === 'edit'}…`). Pass `settings`, `onChange`
  (`saveSettings`), `onExport`, `onImport`, and `onClose` (calls `setSurface('settings', false)`).
- Keep the footer gear button; it calls `setSurface('settings', true)` (or a `toggleSettings`). Since
  settings is now a content surface, ensure the footer/topbar remain visible and only `.content` swaps
  (same as search).
- On open, call `commitPending()` first (mirror `openSearch`) so a pending edit is flushed before the
  editor unmounts.
- Remove the old `open={activeSurface === 'settings'}` popover prop plumbing if it's superseded by the
  page rendering (the surface id stays; only the consumer changes).

### 3. Interaction / coordination

- The `setSurface`/`nextSurface` logic is unchanged: opening settings closes any other surface and vice
  versa. Verify the keyboard `Cmd/Ctrl+/` search toggle and the dropdown still interoperate (opening
  search from within settings closes settings, etc.).
- Escape closes the settings page (add an Escape handler in the page like `SearchPanel.onKeydown`).

### 4. Docs

- `docs/architecture.md`: update the component map (`SettingsPanel.svelte` replaces the
  `SettingsMenu.svelte` popover), and the **UI layout contract** — settings is now a full-page surface
  in the middle region (like search), not a bottom-left popover. Update the surfaces note if wording
  implies a popover.
- `docs/overview.md`: adjust any mention of a settings popover.
- `docs/roadmap/index.md`: move this item out of Next Tasks when shipped.

## Caveats

- **Behavior parity is the bar.** The backup export/import flow (Blob download, file picker, the
  `confirm('Importing will replace…')`, the skipped-count status message) must work exactly as before —
  it's just relocated. Don't silently change the confirm or the messaging.
- **Don't break the single-active-surface invariant.** Settings must go through `setSurface` like the
  others; two surfaces open at once is a regression. Opening settings must close search/organize/
  dropdown/info and vice versa.
- **Flush autosave on open.** Swapping the editor out for the settings page without `commitPending()`
  could drop an in-flight edit — call it first, as `openSearch` does.
- **Footer vs content.** The gear lives in the footer; make sure opening the page doesn't hide the
  footer/topbar in a way that traps the user — closing must always be reachable (header close + Escape).
- **No data-model change.** This task must not touch `Settings`/`normalizeSettings`; adding fields is
  the dependent tasks' job. Keep the diff to UI container + wiring.
- **Session/restore.** Unlike search, the settings page does **not** need to persist "open" across panel
  reopen (search does via `SessionSearchStateRepository`). Don't add persistence — settings should open
  fresh; the panel should reopen on the note, not the settings page.
- **Accessibility.** The page needs a proper heading and a focusable close control; focus should move
  into the page on open and back sensibly on close. Verify light/dark.

## Relevant tests

This is a UI container move with no new pure logic, so it's verified by **manual E2E** (Svelte
components are covered by manual E2E per `CLAUDE.md`). Keep the existing suite green — no settings
*logic* changed, so `tests/settings/*` must still pass unchanged.

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked):**
1. Click the gear → a full **Settings page** opens in the content area (editor/view replaced), with a
   title and a close control; the footer/topbar stay put.
2. Change Theme and "View on note switch" → they apply exactly as before and persist across reopen.
3. Backup: Export downloads the JSON; Import prompts the confirm, replaces notes, and shows the
   skipped-count status message — all as before.
4. Open search or the notes dropdown while settings is open → settings closes (single active surface);
   and opening settings closes search/organize.
5. Press Escape or the close button → returns to the editor on the current note.
6. Reopen the panel → it opens on the note (not the settings page); UI correct in light and dark.
