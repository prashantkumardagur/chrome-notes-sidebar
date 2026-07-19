/**
 * App-level user settings: theme and the view-mode preference.
 *
 * Pure types/helpers live here; persistence goes through the {@link SettingsRepository}
 * seam (see `SettingsRepository.ts` / `SyncSettingsRepository.ts`).
 */

/** How the panel picks its color theme. `system` follows the OS. */
export type ThemePref = "system" | "light" | "dark";

/** Which editor mode a note opens in when you switch notes. */
export type ViewPref = "persistent" | "edit" | "view";

/** The two editor modes (mirrors ViewEditTabs / App). */
export type EditorMode = "edit" | "view";

/** Editor/View text size step; scales both the Edit textarea and the rendered View. */
export type FontSize = "sm" | "md" | "lg";
/** Line-height step for both Edit and View. */
export type LineSpacing = "comfortable" | "compact";
/** Font family for the Edit textarea only (View keeps its own typographic styles). */
export type EditorFont = "mono" | "sans";

export interface Settings {
  theme: ThemePref;
  /**
   * `persistent` keeps whatever mode is active when you switch notes; `edit`/`view`
   * force that mode on every note change.
   */
  view: ViewPref;
  /** Id of the note last opened, restored on panel open. Device cursor; may be stale. */
  lastNoteId?: string;
  // Editor preferences. Each is optional and omitted when at its default (like
  // lastNoteId) so stored/normalized objects stay a clean { theme, view }.
  /** Text size for Edit + View. Default `md`. */
  fontSize?: FontSize;
  /** Line spacing for Edit + View. Default `comfortable`. */
  lineSpacing?: LineSpacing;
  /** Edit textarea font family. Default `mono`. */
  editorFont?: EditorFont;
  /** Soft-wrap long lines in the Edit textarea. Default `true`. */
  wordWrap?: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: "system", view: "persistent" };

// Defaults for the optional editor prefs. Kept off DEFAULT_SETTINGS so the
// normalized "nothing set" object stays exactly { theme, view }.
export const DEFAULT_FONT_SIZE: FontSize = "md";
export const DEFAULT_LINE_SPACING: LineSpacing = "comfortable";
export const DEFAULT_EDITOR_FONT: EditorFont = "mono";
export const DEFAULT_WORD_WRAP = true;

const THEME_PREFS: readonly ThemePref[] = ["system", "light", "dark"];
const VIEW_PREFS: readonly ViewPref[] = ["persistent", "edit", "view"];
const FONT_SIZES: readonly FontSize[] = ["sm", "md", "lg"];
const LINE_SPACINGS: readonly LineSpacing[] = ["comfortable", "compact"];
const EDITOR_FONTS: readonly EditorFont[] = ["mono", "sans"];

/**
 * Merge stored (possibly partial or corrupt) settings with defaults, dropping any
 * unknown values. Keeps back-compat as the settings shape grows over time.
 */
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const theme = raw?.theme && THEME_PREFS.includes(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme;
  const view = raw?.view && VIEW_PREFS.includes(raw.view) ? raw.view : DEFAULT_SETTINGS.view;
  // Carry a valid lastNoteId through, but omit it otherwise so stored/normalized
  // objects stay a clean { theme, view } when there's no cursor to remember.
  const result: Settings = { theme, view };
  if (typeof raw?.lastNoteId === "string" && raw.lastNoteId.length > 0) {
    result.lastNoteId = raw.lastNoteId;
  }
  // Editor prefs: keep a valid non-default value, otherwise omit the key entirely
  // (same rule as lastNoteId) so an unset pref never appears in the stored object.
  if (raw?.fontSize && FONT_SIZES.includes(raw.fontSize) && raw.fontSize !== DEFAULT_FONT_SIZE) {
    result.fontSize = raw.fontSize;
  }
  if (raw?.lineSpacing && LINE_SPACINGS.includes(raw.lineSpacing) && raw.lineSpacing !== DEFAULT_LINE_SPACING) {
    result.lineSpacing = raw.lineSpacing;
  }
  if (raw?.editorFont && EDITOR_FONTS.includes(raw.editorFont) && raw.editorFont !== DEFAULT_EDITOR_FONT) {
    result.editorFont = raw.editorFont;
  }
  if (typeof raw?.wordWrap === "boolean" && raw.wordWrap !== DEFAULT_WORD_WRAP) {
    result.wordWrap = raw.wordWrap;
  }
  return result;
}

// Font stacks the editor picks between. Mono mirrors the components' existing stack.
const MONO_STACK = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const SANS_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Discrete pref → CSS value maps. Edit runs a touch smaller than View at each step.
const EDITOR_FONT_SIZES: Record<FontSize, string> = { sm: "12px", md: "13px", lg: "15px" };
const CONTENT_FONT_SIZES: Record<FontSize, string> = { sm: "13px", md: "14px", lg: "16px" };
const CONTENT_LINE_HEIGHTS: Record<LineSpacing, string> = { comfortable: "1.6", compact: "1.35" };

/**
 * Map the editor prefs to the CSS custom properties the panel consumes (applied at
 * the document root, like `applyTheme`). Pure + total so it's unit-testable; the
 * components just read these vars. Word-wrap is expressed as the `--editor-white-space`
 * value (`pre-wrap` wraps, `pre` scrolls) so a single test covers it.
 */
export function resolveEditorVars(s: Settings): Record<string, string> {
  const fontSize = s.fontSize ?? DEFAULT_FONT_SIZE;
  const lineSpacing = s.lineSpacing ?? DEFAULT_LINE_SPACING;
  const editorFont = s.editorFont ?? DEFAULT_EDITOR_FONT;
  const wordWrap = s.wordWrap ?? DEFAULT_WORD_WRAP;
  return {
    "--editor-font-size": EDITOR_FONT_SIZES[fontSize],
    "--content-font-size": CONTENT_FONT_SIZES[fontSize],
    "--content-line-height": CONTENT_LINE_HEIGHTS[lineSpacing],
    "--editor-font-family": editorFont === "sans" ? SANS_STACK : MONO_STACK,
    "--editor-white-space": wordWrap ? "pre-wrap" : "pre",
  };
}

/**
 * Write the resolved editor vars onto the document root (mirrors `applyTheme`). The
 * components read them via `var(--…)`, so this is the only place they touch the DOM.
 */
export function applyEditorVars(vars: Record<string, string>, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

/**
 * The editor mode a note should open in on note change, given the view preference
 * and the currently active mode. `persistent` keeps the current mode.
 */
export function resolveViewMode(pref: ViewPref, current: EditorMode): EditorMode {
  if (pref === "edit") return "edit";
  if (pref === "view") return "view";
  return current;
}

/**
 * Apply a theme preference to the document root. `system` removes the override so
 * CSS falls back to `prefers-color-scheme`; `light`/`dark` force the theme via a
 * `data-theme` attribute that the stylesheet keys off.
 */
export function applyTheme(theme: ThemePref, root: HTMLElement = document.documentElement): void {
  if (theme === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}
