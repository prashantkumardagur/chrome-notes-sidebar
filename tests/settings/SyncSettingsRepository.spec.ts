import { describe, expect, it } from "vitest";
import { SyncSettingsRepository } from "../../src/lib/settings/SyncSettingsRepository";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";

/** Minimal in-memory stand-in for a chrome.storage.StorageArea. */
function fakeArea() {
  const store = new Map<string, unknown>();
  const area = {
    async get(key: string) {
      return store.has(key) ? { [key]: store.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    },
    async remove(key: string) {
      store.delete(key);
    },
  } as unknown as chrome.storage.StorageArea;
  return { area, store };
}

describe("SyncSettingsRepository", () => {
  it("returns defaults when nothing is stored", async () => {
    const { area } = fakeArea();
    const repo = new SyncSettingsRepository(area);
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings", async () => {
    const { area } = fakeArea();
    const repo = new SyncSettingsRepository(area);
    const saved = await repo.save({ theme: "dark", view: "view" });
    expect(saved).toEqual({ theme: "dark", view: "view" });
    expect(await repo.get()).toEqual({ theme: "dark", view: "view" });
  });

  it("sanitizes corrupt stored settings on read", async () => {
    const { area, store } = fakeArea();
    store.set("settings", { theme: "neon", view: 42 });
    const repo = new SyncSettingsRepository(area);
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS);
  });
});
