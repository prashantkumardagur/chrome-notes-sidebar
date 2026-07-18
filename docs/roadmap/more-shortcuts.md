# More keyboard shortcuts

> Roadmap item (was Deferred: "More shortcuts"). Its own small PR. Adds in-panel shortcuts for the
> common note actions, consolidated behind one keymap.

## Why?

The app has exactly one in-panel shortcut today — `Cmd/Ctrl+/` toggles search (a window `keydown`
listener in `src/sidepanel/App.svelte`). Everything else (switching Edit/View, opening settings or the
info popover, creating a note, moving between notes) is mouse-only. For a keyboard-first notes tool
used in a side panel, that's friction on the most frequent actions. This adds a small, curated set of
shortcuts that work **whenever the side panel has focus** (the listener lives in the panel document, so
it never fires while the user is on the page), and it does so through a single **keymap** so the
bindings live in one testable place instead of scattered `if` checks.

## What?

When done, the following shortcuts work while the side panel has focus (modifier = `⌘` on macOS,
`Ctrl` on Windows/Linux):

| Action | Shortcut |
|---|---|
| Toggle search | `⌘/Ctrl + /` (unchanged — folded into the keymap) |
| Toggle Edit/View mode | `⌘/Ctrl + Shift + E` |
| Toggle settings | `⌘/Ctrl + ,` |
| Toggle info popover | `⌘/Ctrl + .` |
| New note | `⌘/Ctrl + Shift + A` |
| Previous note | `⌘/Ctrl + Shift + ,` |
| Next note | `⌘/Ctrl + Shift + .` |

Behavior details:
- **Toggle actions** flip the corresponding surface/state via the existing coordinators (search &
  settings & info go through the single-active-surface mechanism; view flips the editor mode).
- **New note** creates a note (no-op at the 10-note cap, like the existing button).
- **Previous/Next note** move through the notes list in its current order, **wrapping** at the ends;
  no-op with a single note.
- A shortcut only fires when it **exactly** matches (correct modifier, correct Shift state); all other
  key combos (including the textarea's own `⌘A/C/V/X/Z` and the formatting toolbar's `⌘B/I/K`) pass
  through untouched.

**In scope:** a pure keymap module (binding table + a `matchShortcut` matcher) with unit tests;
replacing the inline `Cmd/Ctrl+/` handler in `App.svelte` with a keymap-driven dispatcher; a
`cycleNote` helper; docs.

**Out of scope:** user-configurable/rebindable shortcuts (Chrome owns rebinding only for the manifest
`commands` entry, not page-level keys); a shortcuts cheat-sheet UI (that's
[keyboard-shortcuts-reference.md](./keyboard-shortcuts-reference.md)); the browser-level panel-toggle
shortcut (`open-panel`, already in the manifest); new `commands` manifest entries.

## Decisions

Locked during specification. Do not relitigate:

- **Exact bindings** as in the table above. Rationale: chosen with the user, each checked against (a)
  the app's own keys, (b) Chrome-reserved accelerators, and (c) macOS **global** shortcuts:
  - `⌘/Ctrl+Shift+E` (view): free; plain `Ctrl+E` is the Windows address-bar search, so the Shift form
    is used.
  - `⌘/Ctrl+,` (settings): the standard "Preferences" key; Chrome leaves it unbound, so the page
    receives it. Mnemonic.
  - `⌘/Ctrl+.` (info): free in Chrome. **Known nuance:** `⌘.` is the classic macOS "Cancel/Stop"
    convention (app-level, not a global; Chrome doesn't bind it, so it still works). Accepted; `⌘/Ctrl+'`
    is the fallback if it ever feels wrong.
  - `⌘/Ctrl+Shift+A` (new note): free (`⌘N`/`⌘⇧N` are new-window/incognito, reserved).
  - `⌘/Ctrl+Shift+,` / `⌘/Ctrl+Shift+.` (prev/next): the `<` / `>` mnemonic; portable and clash-free
    (`⌘⇧[`/`]` and `Ctrl+PageUp/Dn` switch tabs; `⌥/⌘`+arrows move the caret or switch tabs — all
    avoided).
- **Rejected: Option/Alt-based shortcuts.** Rationale: on macOS `⌥` composes special characters in the
  textarea (shadowing them) and `⌥`+arrows move the caret; on Windows/Linux `Alt` drives menu mnemonics
  and `Alt+←/→` is back/forward. Not reliably cross-platform for a published extension.
- **Match on `event.code` + exact modifier flags, not `event.key`.** Rationale: `Shift+,` produces the
  character `<` (and layouts vary), which breaks `key`-based matching; `code` (`Comma`, `Period`,
  `Slash`, `KeyE`, `KeyA`) is stable. And settings (`⌘,`) vs prev-note (`⌘⇧,`) differ only by Shift, so
  matching must check Shift precisely.
- **One window-level listener driven by a pure keymap**, replacing the inline `Cmd/Ctrl+/` check.
  Rationale: single source of truth, unit-testable, and it can back the shortcuts-reference list so the
  two never drift.
- **Modifier = `metaKey || ctrlKey`** (either), matching the existing search handler. Rationale:
  consistency with today's behavior; `⌘` on Mac, `Ctrl` elsewhere, and neither is wrong.

## How?

### 1. `src/lib/shortcuts/keymap.ts` (new, pure)

```ts
export type ShortcutAction =
  | "toggle-search" | "toggle-settings" | "toggle-info"
  | "toggle-view" | "new-note" | "prev-note" | "next-note";

interface Binding { code: string; shift: boolean; action: ShortcutAction; }

// Every binding also requires (meta||ctrl) and NOT alt.
const BINDINGS: Binding[] = [
  { code: "Slash",  shift: false, action: "toggle-search" },
  { code: "KeyE",   shift: true,  action: "toggle-view" },
  { code: "Comma",  shift: false, action: "toggle-settings" },
  { code: "Period", shift: false, action: "toggle-info" },
  { code: "KeyA",   shift: true,  action: "new-note" },
  { code: "Comma",  shift: true,  action: "prev-note" },
  { code: "Period", shift: true,  action: "next-note" },
];

/** Resolve a keydown to an action, or null if it isn't one of ours. */
export function matchShortcut(e: Pick<KeyboardEvent,
  "code" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey">): ShortcutAction | null;
```

- `matchShortcut`: return `null` unless `(metaKey || ctrlKey)` and `!altKey`; then find the binding with
  matching `code` and `shift === shiftKey`; return its action or `null`.
- Optionally export the `BINDINGS` (or a display-friendly view) so
  [keyboard-shortcuts-reference.md](./keyboard-shortcuts-reference.md) can render from the same source.

### 2. `src/sidepanel/App.svelte` — dispatch

- Replace the existing `Cmd/Ctrl+/` `$effect` (the `window.addEventListener('keydown', …)` that calls
  `toggleSearch`) with one listener that does: `const action = matchShortcut(e); if (!action) return;
  e.preventDefault();` then `switch (action)`:
  - `toggle-search` → `toggleSearch()`
  - `toggle-settings` → `setSurface('settings', activeSurface !== 'settings')`
  - `toggle-info` → `setSurface('info', activeSurface !== 'info')`
  - `toggle-view` → `mode = mode === 'edit' ? 'view' : 'edit'`
  - `new-note` → `void createNote()`
  - `prev-note` → `cycleNote(-1)` ; `next-note` → `cycleNote(1)`
- Add `cycleNote(delta)`: if `notes.length <= 1` return; find the current index in `notes`
  (`notes.findIndex(n => n.id === current?.id)`), compute `(idx + delta + notes.length) % notes.length`,
  and `void selectNote(notes[next].id)` (which already flushes pending edits and applies the view
  preference). Fall back to `notes[0]` if the current id isn't found.
- Only `preventDefault` when an action matched, so unrelated `⌘`-combos still reach the textarea/browser.

### 3. Docs

- `docs/overview.md`: list the new shortcuts.
- `docs/architecture.md`: add `src/lib/shortcuts/keymap.ts` and note the single dispatch listener.
- `docs/decisions.md`: (optional) a row on the keymap + the event.code decision.
- `docs/roadmap/index.md`: move this item out of Deferred/Next Tasks when shipped.

## Caveats

- **Shift precision.** `⌘,`/`⌘⇧,` (settings vs prev-note) and `⌘.`/`⌘⇧.` (info vs next-note) share a
  physical key; the matcher MUST compare `shiftKey` exactly, or one will shadow the other. Covered by
  tests.
- **Use `event.code`, not `event.key`.** `Shift+,` is `<` in `key`; `code` stays `Comma`. This also
  keeps behavior sane across keyboard layouts (with the usual `code`=physical-position caveat).
- **Don't swallow other combos.** Only `preventDefault` on a matched action. Overreaching would break
  `⌘A/C/V/X/Z` in the textarea and the formatting toolbar's `⌘B/I/K`.
- **No clash with the formatting toolbar.** `⌘B/I/K` are editor-scoped (textarea listener in that
  task); this set uses different keys and a window listener — they coexist. Don't move formatting keys
  here.
- **`⌘,` / `⌘.` reaching the page.** Both are believed free in Chrome (settings unbound; `⌘.` is a Mac
  app-level cancel convention Chrome doesn't bind). Verify in manual E2E they aren't swallowed; if a
  future Chrome build binds one, swap to the noted fallback (`⌘/Ctrl+'`).
- **Firing while a text field is focused.** All bindings use a modifier, so they don't interfere with
  typing. Edge case: pressing `⌘⇧A` while the note-rename input is focused still creates a note — minor
  and acceptable; don't add special-casing unless it proves annoying.
- **Coordination, not hard dependencies:**
  - [keyboard-shortcuts-reference.md](./keyboard-shortcuts-reference.md) should display these; whichever
    task lands second should point the reference list at this keymap so they can't drift.
  - `toggle-settings` works with today's settings popover and with the page from
    [settings-page.md](./settings-page.md); no ordering dependency.
- **Accessibility.** These augment, not replace, the mouse affordances; every action still has its
  button. Nothing here should trap focus.

## Relevant tests

Pure keymap logic is unit-tested; the dispatch wiring is verified by manual E2E.

**New `tests/shortcuts/keymap.spec.ts`** for `matchShortcut`:
- Each binding resolves with `metaKey` set and (separately) with `ctrlKey` set.
- Shift discrimination: `{code:'Comma', shift:false}`→`toggle-settings`, `{code:'Comma', shift:true}`→
  `prev-note`; same for `Period` → `toggle-info` / `next-note`.
- Returns `null` when neither meta nor ctrl is held, when `altKey` is held, and for unmapped codes.
- `⌘⇧E`→`toggle-view`, `⌘⇧A`→`new-note`, `⌘/`→`toggle-search`.

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked; test on macOS and, if possible, Windows/Linux):**
1. `⌘/Ctrl+Shift+E` toggles Edit/View; `⌘/Ctrl+,` opens/closes settings; `⌘/Ctrl+.` opens/closes the
   info popover; `⌘/Ctrl+/` still toggles search.
2. `⌘/Ctrl+Shift+A` creates a note (and is a no-op at 10 notes).
3. `⌘/Ctrl+Shift+,` / `⌘/Ctrl+Shift+.` move to previous/next note and wrap around; no-op with one note.
4. While typing in the editor, `⌘A` still selects all, `⌘C/⌘V` copy/paste, and (if the formatting
   toolbar exists) `⌘B/I/K` still format — none are hijacked.
5. Confirm `⌘,` and `⌘.` are not swallowed by Chrome (they toggle settings/info as expected).
6. Shortcuts do nothing when the panel is not focused (focus a normal tab, press them → no effect).
