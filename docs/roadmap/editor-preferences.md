# Editor preferences (font size, wrap, font family, line spacing)

> Roadmap item (Deferred): "Editor preferences: font size and word-wrap toggle in the settings menu."
> Expanded during specification to also include an editor font-family toggle and a line-spacing option.
> Its own small PR.

## Why?

The editor is a fixed 13px monospace, always-wrapped textarea (`MarkdownEditor.svelte`), and View is a
fixed 14px block (`MarkdownView.svelte`). Different people want different reading/writing comfort:
larger text, tighter or looser line spacing, prose in a proportional font instead of monospace, or
no-wrap for code-heavy notes. A small set of preferences in the existing settings gear — persisted and
synced like theme/view — lets each user tune the surface without touching anyone else's.

## What?

When done, the settings gear (`SettingsMenu.svelte`) gains editor preferences, each **persisted in
synced `Settings`** and applied live:

- **Font size — Small / Medium / Large** (default Medium). Scales **both** the Edit textarea and the
  rendered View.
- **Line spacing — Comfortable / Compact** (default Comfortable). Sets line-height for **both** Edit
  and View.
- **Editor font — Mono / Sans** (default Mono). Switches the **Edit textarea** font between the
  monospace stack and a proportional/sans stack. (Editor only — View keeps its own typographic styles,
  including monospace for code.)
- **Word wrap — On / Off** (default On). Toggles soft-wrapping in the **Edit textarea**; Off shows long
  lines with horizontal scroll. (Editor only — View already wraps prose and scrolls code blocks.)

Preferences apply immediately on change and are restored on panel open across devices.

**In scope:** the four preference fields + normalization; a pure resolver mapping prefs → CSS variable
values; applying those variables at the document root (like `applyTheme`); the settings UI controls;
`MarkdownEditor`/`MarkdownView` consuming the variables; unit tests for normalization + the resolver;
docs.

**Out of scope:** a free-form font-size slider or custom font picker (discrete steps only); per-note
preferences (these are global); spellcheck toggle and other prefs not chosen; theming colors (that's
the existing theme setting).

## Decisions

Locked during specification. Do not relitigate:

- **Four prefs: font size (S/M/L), line spacing (comfortable/compact), editor font (mono/sans), word
  wrap (on/off).** Rationale: user's selection. (Spellcheck toggle was offered and not chosen.)
- **Font size + line spacing apply to Edit *and* View; editor font + word-wrap apply to Edit only.**
  Rationale: user chose "both" for sizing; font-family and wrap are only meaningful in the raw editor
  (View renders Markdown with its own fonts and already wraps/scrolls appropriately).
- **Applied via CSS custom properties set at the document root, driven by a pure resolver.** Rationale:
  mirrors the theme system (`applyTheme` + `--` vars). A pure `resolveEditorVars(settings)` is
  unit-testable; the components just consume the variables. No inline per-component style logic.
- **Stored as optional fields on `Settings`, omitted when at their default.** Rationale: matches the
  established `lastNoteId`/`sortMode` convention, keeping stored/normalized objects clean and the exact
  existing `normalizeSettings` tests green.
- **Discrete steps, not sliders.** Rationale: simpler UI/state, predictable, matches the segmented
  controls already used for theme/view.

## How?

### 1. `src/lib/settings/settings.ts` — types, defaults, normalization, resolver

- Add types and fields (optional, default-omitted):
  ```ts
  export type FontSize = "sm" | "md" | "lg";
  export type LineSpacing = "comfortable" | "compact";
  export type EditorFont = "mono" | "sans";
  // in Settings:
  fontSize?: FontSize;      // default "md"
  lineSpacing?: LineSpacing;// default "comfortable"
  editorFont?: EditorFont;  // default "mono"
  wordWrap?: boolean;       // default true
  ```
- Extend `normalizeSettings` to validate each against its allowed set (and `wordWrap` as a boolean),
  **omitting** any that equal the default so `{ theme, view }`-only inputs still normalize to exactly
  that (guard the existing tests).
- Add a pure resolver:
  ```ts
  /** Map editor prefs to the CSS custom properties the panel consumes. */
  export function resolveEditorVars(s: Settings): Record<string, string>;
  ```
  Returns values for e.g. `--editor-font-size`, `--content-font-size`, `--content-line-height`,
  `--editor-font-family`, and an editor wrap flag (see below). Suggested mappings: font size
  sm/md/lg → editor `12/13/15px` and view `13/14/16px`; line spacing comfortable/compact → `1.6/1.35`;
  editor font mono → the existing monospace stack, sans → a system sans stack.
- Word-wrap is a boolean toggling behavior, not a numeric var; expose it either as a var
  (`--editor-white-space: pre-wrap | pre`) or drive a class. Keep the decision in the resolver so it's
  covered by one test.

### 2. `src/sidepanel/App.svelte` — apply on change

- Add an `$effect` mirroring the theme one:
  `$effect(() => applyEditorVars(resolveEditorVars(settings)))` — where `applyEditorVars` sets each
  returned property on `document.documentElement.style` (a tiny DOM helper next to `applyTheme`, or
  inline). This runs on load (settings restored in `onMount`) and on every settings change via
  `saveSettings`.

### 3. Components consume the variables

- `MarkdownEditor.svelte` `.editor`: replace hard-coded `font-size: 13px`, `font-family: …mono…`,
  `line-height: 1.6` with `var(--editor-font-size, 13px)`, `var(--editor-font-family, <mono stack>)`,
  `var(--content-line-height, 1.6)`; add `white-space: var(--editor-white-space, pre-wrap)` and, for
  no-wrap, `overflow-x: auto` so long lines scroll. Set `wrap` attribute on the textarea accordingly.
- `MarkdownView.svelte` `.view`: `font-size: var(--content-font-size, 14px)`;
  `line-height: var(--content-line-height, …)` on the body. Do **not** override code-block monospace or
  the editor-font pref here.

### 4. `src/components/SettingsMenu.svelte` — controls

- Add fieldsets following the existing segmented pattern (`THEME_OPTIONS`/`VIEW_OPTIONS`): **Font size**
  (Small/Medium/Large), **Line spacing** (Comfortable/Compact), **Editor font** (Mono/Sans), and
  **Word wrap** (On/Off). Each calls `onChange({ ...settings, <field>: value })` (omitting when default,
  consistent with normalization). Keep labels short; the popover is `min-width: 200px`.

### 5. Docs

- `docs/overview.md`: mention editor preferences (size, spacing, font, wrap).
- `docs/decisions.md`: a row — editor prefs in synced settings, applied via `--` vars like theme.
- `docs/architecture.md`: note `resolveEditorVars` + the vars the components consume.
- `docs/roadmap/index.md`: remove this item from Deferred.

## Caveats

- **Keep `normalizeSettings` exact-shape tests green.** Omit each pref when it equals its default so
  `normalizeSettings({theme, view})` still `toEqual({theme, view})` (same rule as `lastNoteId`,
  `sortMode`).
- **Word-wrap must actually give horizontal scroll when off.** Setting `white-space: pre` without
  `overflow-x: auto` on the textarea clips long lines. Also set the textarea `wrap="off"` for correct
  behavior/copy semantics.
- **Don't let the editor-font (sans) pref leak into View or code blocks.** Font-family is editor-only;
  View's code must stay monospace. Scope the `--editor-font-family` var to `.editor`.
- **Font-size affects layout height.** Large size + the (planned) formatting toolbar must still fit the
  panel; ensure the editor keeps `min-height: 0` in its flex parent so it scrolls rather than overflow.
- **Line-height var name collision.** `--content-line-height` is shared by editor + View; pick a single
  source of truth and don't also hard-code line-height in either component.
- **Sync writes.** Changing a pref writes the settings item; that's well under the write-rate cap
  (occasional user action), but reuse `saveSettings` (which already persists) rather than adding a new
  path.
- **Accessibility/themes.** New controls need labels/`aria-pressed` like the existing segmented
  buttons, and must look right in light and dark.

## Relevant tests

Pure logic is unit-tested; the applied styling is verified by manual E2E.

**Extend `tests/settings/settings.spec.ts`:**
- Each pref: a valid value is carried through; invalid/absent/default is omitted (no key), and existing
  `toEqual({theme,view})` cases still pass. `wordWrap` accepts only booleans.
- `resolveEditorVars`: returns the expected var map for defaults, and changes the right vars for each
  non-default pref (e.g. `lg` bumps both `--editor-font-size` and `--content-font-size`; `compact`
  lowers `--content-line-height`; `sans` changes `--editor-font-family` only; `wordWrap:false` sets the
  no-wrap value).

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked):**
1. Set Font size Large → both the editor and View text grow; Small → both shrink. Reopen the panel →
   the choice persists.
2. Line spacing Compact → lines tighten in Edit and View; Comfortable → restored.
3. Editor font Sans → the textarea becomes proportional; View and code blocks stay unchanged.
4. Word wrap Off → a long line in the editor scrolls horizontally instead of wrapping; On → wraps
   again. View is unaffected.
5. Toggle Light/Dark → all controls and text render correctly in both themes.
