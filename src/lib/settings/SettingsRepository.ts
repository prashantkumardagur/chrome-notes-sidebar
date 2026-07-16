/**
 * Backend-agnostic contract for settings persistence.
 *
 * Like {@link NotesRepository}, this is a storage seam: UI/stores talk to it and
 * never touch a storage API directly. The concrete implementation
 * ({@link SyncSettingsRepository}) is the only place that reads/writes settings.
 */

import type { Settings } from "./settings";

export interface SettingsRepository {
  /** Load the current settings, falling back to defaults for anything unset. */
  get(): Promise<Settings>;
  /** Persist the full settings object; returns what was stored. */
  save(settings: Settings): Promise<Settings>;
}
