import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, DEFAULT_SETTINGS, normalizeSettings, resolveViewMode } from "../../src/lib/settings/settings";

describe("normalizeSettings", () => {
  it("returns defaults for null/undefined/empty input", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values", () => {
    expect(normalizeSettings({ theme: "dark", view: "view" })).toEqual({ theme: "dark", view: "view" });
  });

  it("drops unknown values back to defaults", () => {
    // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
    const raw = { theme: "solarized", view: "readonly" } as any;
    expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it("normalizes each field independently", () => {
    // biome-ignore lint/suspicious/noExplicitAny: partial/corrupt stored input
    expect(normalizeSettings({ theme: "light", view: "bogus" as any })).toEqual({
      theme: "light",
      view: "persistent",
    });
  });
});

describe("resolveViewMode", () => {
  it("keeps the current mode when persistent", () => {
    expect(resolveViewMode("persistent", "edit")).toBe("edit");
    expect(resolveViewMode("persistent", "view")).toBe("view");
  });

  it("forces the preferred mode otherwise", () => {
    expect(resolveViewMode("edit", "view")).toBe("edit");
    expect(resolveViewMode("view", "edit")).toBe("view");
  });
});

describe("applyTheme", () => {
  const root = document.createElement("div");
  afterEach(() => {
    delete root.dataset.theme;
  });

  it("sets a data-theme attribute for explicit themes", () => {
    applyTheme("dark", root);
    expect(root.dataset.theme).toBe("dark");
    applyTheme("light", root);
    expect(root.dataset.theme).toBe("light");
  });

  it("removes the override for system", () => {
    root.dataset.theme = "dark";
    applyTheme("system", root);
    expect(root.dataset.theme).toBeUndefined();
  });
});
