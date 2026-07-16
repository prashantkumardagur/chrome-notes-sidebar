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

export interface Settings {
  theme: ThemePref;
  /**
   * `persistent` keeps whatever mode is active when you switch notes; `edit`/`view`
   * force that mode on every note change.
   */
  view: ViewPref;
}

export const DEFAULT_SETTINGS: Settings = { theme: "system", view: "persistent" };

const THEME_PREFS: readonly ThemePref[] = ["system", "light", "dark"];
const VIEW_PREFS: readonly ViewPref[] = ["persistent", "edit", "view"];

/**
 * Merge stored (possibly partial or corrupt) settings with defaults, dropping any
 * unknown values. Keeps back-compat as the settings shape grows over time.
 */
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const theme = raw?.theme && THEME_PREFS.includes(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme;
  const view = raw?.view && VIEW_PREFS.includes(raw.view) ? raw.view : DEFAULT_SETTINGS.view;
  return { theme, view };
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
