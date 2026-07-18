# Keyboard shortcuts reference in the info popover

> New roadmap item. Its own small PR. Coexists with [note-stats.md](./note-stats.md) and
> [markdown-cheat-sheet.md](./markdown-cheat-sheet.md) — all three add content to the ⓘ info popover;
> if more than one lands, keep the popover coherent (stats rows first, then the collapsible sections).

## Why?

The app has keyboard shortcuts but nowhere in the UI that lists them: the panel **toggle** shortcut
(`open-panel` command, default `Ctrl+Shift+Y` / `⌘+Shift+Y`, rebindable at
`chrome://extensions/shortcuts`), **Search** (`Cmd/Ctrl+/`, a window listener in
`src/sidepanel/App.svelte`), and **Escape** to close the open surface. A user has no way to discover or
recall these without hunting through docs. Surfacing them in the ⓘ info popover
(`src/components/UtilityBar.svelte`) — the app's existing "about this note / how things work" surface —
makes them discoverable in-panel, mirroring the planned Markdown cheat-sheet section.

## What?

When done, the ⓘ info popover contains a **collapsible "Keyboard shortcuts" section** listing the app's
current shortcuts as **shortcut → action** rows:

- **Toggle panel** — the **live** assigned key for the `open-panel` command, read at runtime (reflects
  a user's custom rebinding), falling back to the platform default label if unset.
- **Search** — `⌘/Ctrl` + `/` (rendered per platform).
- **Close / exit surface** — `Esc`.

Modifier keys render **per platform**: `⌘` on macOS, `Ctrl` elsewhere. The section is collapsed by
default and read-only (it documents shortcuts; it does not add or change any binding).

**In scope:** a pure shortcut-list builder (platform + live toggle key → rows) with unit tests; reading
the live `open-panel` binding via `chrome.commands.getAll()`; platform detection; a collapsible section
in the info popover; docs.

**Out of scope:** adding new key bindings; a settings/rebinding UI (Chrome owns that at
`chrome://extensions/shortcuts`); listing not-yet-built shortcuts (e.g. the planned formatting
`Cmd/Ctrl+B/I/K` — only existing shortcuts are listed); a separate help page/surface.

## Decisions

Locked during specification. Do not relitigate:

- **A collapsible `<details>` "Keyboard shortcuts" section in the ⓘ info popover**, like the planned
  Markdown cheat sheet. Rationale: user's choice; reuses the existing help surface, collapsed by default
  so it doesn't crowd the popover.
- **Read the live toggle binding via `chrome.commands.getAll()`**, not a hard-coded string. Rationale:
  user's choice — the `open-panel` shortcut is user-rebindable, so the reference must reflect the actual
  key; fall back to the platform default label only if the API returns no `shortcut`.
- **Auto-detect platform and render `⌘` on macOS / `Ctrl` elsewhere.** Rationale: user's choice; cleaner
  than the combined "Cmd/Ctrl" labels used in button `title`s.
- **List only shortcuts that exist today** (toggle panel, search, escape). Rationale: user's choice; no
  dependency on unbuilt features. When the formatting toolbar ships, its shortcuts can be added then.
- **Read-only reference — no new bindings, no rebinding UI.** Rationale: rebinding the `commands`
  shortcut is Chrome's job (`chrome://extensions/shortcuts`); the app only documents.
- **`chrome.commands.getAll()` needs no new permission.** Rationale: the `commands` API is available to
  extension pages without a permission entry; the manifest already declares the `open-panel` command.

## How?

### 1. `src/lib/shortcuts/shortcuts.ts` (new, pure)

Keep the display logic pure and unit-testable; the component supplies the runtime inputs (platform +
live key).

```ts
export interface ShortcutRow {
  keys: string;    // e.g. "⌘⇧Y", "Ctrl+Shift+Y", "⌘+/", "Esc"
  action: string;  // e.g. "Toggle panel", "Search", "Close surface"
}

/** Default label for the open-panel command when no live binding is available. */
export function defaultToggleLabel(mac: boolean): string;   // "⌘⇧Y" | "Ctrl+Shift+Y"

/** Build the shortcut rows for display. `toggleKey` is the live binding (from
 *  chrome.commands.getAll), or null/empty to fall back to defaultToggleLabel. */
export function buildShortcutRows(opts: { mac: boolean; toggleKey: string | null }): ShortcutRow[];
```

- `buildShortcutRows` returns: Toggle panel (`toggleKey || defaultToggleLabel(mac)`), Search
  (`${mac ? "⌘" : "Ctrl"}+/`), Close surface (`Esc`). Keep the modifier rendering in one small helper so
  it's consistent and covered by tests.
- The default label should mirror the manifest `suggested_key` (`Command+Shift+Y` mac /
  `Ctrl+Shift+Y` default) rendered in the chosen display style.

### 2. `src/components/UtilityBar.svelte`

- Detect platform once: `const mac = /Mac/i.test(navigator.platform)` (or `navigator.userAgentData`),
  behind a tiny helper.
- Fetch the live toggle binding: on mount (or when the popover first opens), call
  `chrome.commands.getAll()`, find the entry whose `name === "open-panel"` (import the id constant
  `TOGGLE_PANEL_COMMAND` from `src/lib/commands/panelToggle.ts` rather than hard-coding the string), and
  take its `shortcut` (empty string means unbound → fall back). Store it in `$state`; guard for the API
  being unavailable in tests/non-extension contexts (default to `null`).
- Compute rows with `buildShortcutRows({ mac, toggleKey })` and render a
  `<details class="shortcuts"><summary>Keyboard shortcuts</summary>…</details>` after the stats `<dl>`
  (and alongside the cheat-sheet section if present). Show each row as a two-column line: the `keys` in a
  `<kbd>`/`<code>`-style chip, the `action` as text. Theme with existing `--` tokens; verify light/dark.

### 3. Docs

- `docs/overview.md`: mention the in-panel keyboard-shortcuts reference (and note existing shortcuts).
- `docs/architecture.md`: add `src/lib/shortcuts/shortcuts.ts` to the map.
- `docs/roadmap/index.md`: move this item out of Next Tasks when shipped.

## Caveats

- **`chrome.commands.getAll()` is async and may be unavailable in tests.** Fetch it defensively (guard
  `typeof chrome !== "undefined" && chrome.commands`), default `toggleKey` to `null`, and never let a
  missing API throw in the popover. The pure builder must work with `toggleKey: null`.
- **Don't hard-code the command id.** Reuse `TOGGLE_PANEL_COMMAND` (`"open-panel"`) from
  `panelToggle.ts`; the comment there warns the id must stay stable for user rebindings.
- **The live `shortcut` string format varies by platform.** Chrome returns e.g. `⌘⇧Y` on macOS and
  `Ctrl+Shift+Y` on Windows/Linux; display it as-is for the toggle row (don't try to re-parse it), and
  format only the app-level rows (Search/Escape) yourself so the two styles stay reasonably consistent.
- **Keep it read-only.** No rebinding UI, no `chrome.commands` mutation (there is no such API anyway) —
  a reviewer should see documentation only.
- **Popover height.** Adding another collapsible section can push the (upward-opening) popover off the
  top; cap height and scroll internally, consistent with the cheat-sheet caveat.
- **Coexistence.** If note-stats and/or the Markdown cheat sheet also land, keep the popover layout
  coherent (stats rows, then collapsible sections) and make sure the outside-click/Escape close still
  works with a section expanded.
- **Escape semantics.** The listed `Esc` "Close surface" reflects existing behavior (closing
  search/dropdown/popovers); don't imply it does more than it does.

## Relevant tests

Pure logic is unit-tested; the popover display + the `chrome.commands.getAll()` fetch are verified by
manual E2E.

**New `tests/shortcuts/shortcuts.spec.ts`:**
- `defaultToggleLabel(true)` → the macOS label; `defaultToggleLabel(false)` → the Ctrl label.
- `buildShortcutRows({ mac: true, toggleKey: null })` uses `⌘` modifiers and the default toggle label;
  `{ mac: false, ... }` uses `Ctrl`.
- A provided `toggleKey` (e.g. `"⌘⌥N"`) overrides the default in the Toggle-panel row; empty string /
  `null` falls back to the default label.
- Search row renders `⌘+/` on mac and `Ctrl+/` otherwise; Close row is `Esc` on both.

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked):**
1. Open the ⓘ info popover → a collapsed "Keyboard shortcuts" section appears (below the note info /
   stats). Expand it → Toggle panel, Search, and Close rows show.
2. On macOS the modifiers render as `⌘`; on Windows/Linux as `Ctrl`.
3. Rebind the toggle at `chrome://extensions/shortcuts` (e.g. to `⌘+Shift+N`), reopen the popover →
   the Toggle-panel row shows the new key (live binding), not the default.
4. Remove the toggle binding entirely → the row shows the default label (no crash).
5. The section scrolls within the popover if tall and never runs off-screen; correct in light and dark;
   outside-click/Escape still closes the popover with the section expanded.
