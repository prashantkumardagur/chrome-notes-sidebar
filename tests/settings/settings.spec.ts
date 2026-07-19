import { afterEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  DEFAULT_SETTINGS,
  normalizeSettings,
  resolveEditorVars,
  resolveViewMode,
} from "../../src/lib/settings/settings";

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

  it("keeps a valid lastNoteId", () => {
    expect(normalizeSettings({ theme: "dark", view: "view", lastNoteId: "abc" })).toEqual({
      theme: "dark",
      view: "view",
      lastNoteId: "abc",
    });
  });

  it("drops a non-string / empty lastNoteId (no key on the result)", () => {
    for (const bad of [123, "", null, undefined, {}]) {
      // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
      const result = normalizeSettings({ theme: "dark", view: "view", lastNoteId: bad as any });
      expect("lastNoteId" in result).toBe(false);
      expect(result).toEqual({ theme: "dark", view: "view" });
    }
  });

  it("normalizes lastNoteId independently of corrupt theme/view", () => {
    // biome-ignore lint/suspicious/noExplicitAny: partial/corrupt stored input
    const raw = { theme: "solarized", view: "readonly", lastNoteId: "keep-me" } as any;
    expect(normalizeSettings(raw)).toEqual({ ...DEFAULT_SETTINGS, lastNoteId: "keep-me" });
  });

  it("carries valid non-default editor prefs through", () => {
    expect(
      normalizeSettings({
        theme: "dark",
        view: "view",
        fontSize: "lg",
        lineSpacing: "compact",
        editorFont: "sans",
        wordWrap: false,
      }),
    ).toEqual({
      theme: "dark",
      view: "view",
      fontSize: "lg",
      lineSpacing: "compact",
      editorFont: "sans",
      wordWrap: false,
    });
  });

  it("omits editor prefs that equal their default (keeps a clean { theme, view })", () => {
    expect(
      normalizeSettings({
        theme: "dark",
        view: "view",
        fontSize: "md",
        lineSpacing: "comfortable",
        editorFont: "mono",
        wordWrap: true,
      }),
    ).toEqual({ theme: "dark", view: "view" });
  });

  it("drops invalid editor prefs (no key on the result)", () => {
    const result = normalizeSettings({
      theme: "dark",
      view: "view",
      // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
      fontSize: "huge" as any,
      // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
      lineSpacing: "airy" as any,
      // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
      editorFont: "serif" as any,
      // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
      wordWrap: "yes" as any,
    });
    expect(result).toEqual({ theme: "dark", view: "view" });
  });

  it("accepts only booleans for wordWrap", () => {
    // false is valid + non-default → carried through
    expect(normalizeSettings({ theme: "system", view: "persistent", wordWrap: false })).toEqual({
      ...DEFAULT_SETTINGS,
      wordWrap: false,
    });
    // non-boolean → dropped
    // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
    expect("wordWrap" in normalizeSettings({ theme: "system", view: "persistent", wordWrap: 1 as any })).toBe(false);
  });

  it("carries a valid non-default sortMode through", () => {
    expect(normalizeSettings({ theme: "dark", view: "view", sortMode: "title" })).toEqual({
      theme: "dark",
      view: "view",
      sortMode: "title",
    });
    expect(normalizeSettings({ theme: "system", view: "persistent", sortMode: "updated" })).toEqual({
      ...DEFAULT_SETTINGS,
      sortMode: "updated",
    });
  });

  it("omits sortMode when manual/invalid/absent (keeps a clean { theme, view })", () => {
    // manual is the default → omitted
    expect("sortMode" in normalizeSettings({ theme: "dark", view: "view", sortMode: "manual" })).toBe(false);
    // invalid → dropped
    // biome-ignore lint/suspicious/noExplicitAny: exercising corrupt stored input
    expect("sortMode" in normalizeSettings({ theme: "dark", view: "view", sortMode: "created" as any })).toBe(false);
    // absent → no key
    expect("sortMode" in normalizeSettings({ theme: "dark", view: "view" })).toBe(false);
    expect(normalizeSettings({ theme: "dark", view: "view", sortMode: "manual" })).toEqual({
      theme: "dark",
      view: "view",
    });
  });
});

describe("resolveEditorVars", () => {
  it("returns the default var map for base settings", () => {
    expect(resolveEditorVars(DEFAULT_SETTINGS)).toEqual({
      "--editor-font-size": "13px",
      "--content-font-size": "14px",
      "--content-line-height": "1.6",
      "--editor-font-family": "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      "--editor-white-space": "pre-wrap",
    });
  });

  it("large font size bumps both editor and content sizes", () => {
    const vars = resolveEditorVars({ ...DEFAULT_SETTINGS, fontSize: "lg" });
    expect(vars["--editor-font-size"]).toBe("15px");
    expect(vars["--content-font-size"]).toBe("16px");
  });

  it("small font size shrinks both editor and content sizes", () => {
    const vars = resolveEditorVars({ ...DEFAULT_SETTINGS, fontSize: "sm" });
    expect(vars["--editor-font-size"]).toBe("12px");
    expect(vars["--content-font-size"]).toBe("13px");
  });

  it("compact spacing lowers the shared line-height", () => {
    expect(resolveEditorVars({ ...DEFAULT_SETTINGS, lineSpacing: "compact" })["--content-line-height"]).toBe("1.35");
  });

  it("sans editor font changes only the font-family var", () => {
    const vars = resolveEditorVars({ ...DEFAULT_SETTINGS, editorFont: "sans" });
    expect(vars["--editor-font-family"]).toContain("-apple-system");
    expect(vars["--editor-font-family"]).not.toContain("monospace");
    // Sizes/spacing untouched.
    expect(vars["--content-font-size"]).toBe("14px");
    expect(vars["--content-line-height"]).toBe("1.6");
  });

  it("word wrap off sets the no-wrap white-space value", () => {
    expect(resolveEditorVars({ ...DEFAULT_SETTINGS, wordWrap: false })["--editor-white-space"]).toBe("pre");
    expect(resolveEditorVars({ ...DEFAULT_SETTINGS, wordWrap: true })["--editor-white-space"]).toBe("pre-wrap");
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
