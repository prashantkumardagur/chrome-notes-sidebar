/**
 * `chrome.storage.sync`-backed implementation of {@link SettingsRepository}.
 *
 * Settings ride the same sync area as notes so they follow the user across
 * devices. They live under a single small item:
 *   - `settings` -> Settings
 */

import type { SettingsRepository } from "./SettingsRepository";
import { normalizeSettings, type Settings } from "./settings";

const SETTINGS_KEY = "settings";

export class SyncSettingsRepository implements SettingsRepository {
  /** Injected for testability; defaults to the real sync area. */
  constructor(private readonly area: chrome.storage.StorageArea = chrome.storage.sync) {}

  async get(): Promise<Settings> {
    const res = await this.area.get(SETTINGS_KEY);
    return normalizeSettings(res[SETTINGS_KEY] as Partial<Settings> | undefined);
  }

  async save(settings: Settings): Promise<Settings> {
    const clean = normalizeSettings(settings);
    await this.area.set({ [SETTINGS_KEY]: clean });
    return clean;
  }
}
