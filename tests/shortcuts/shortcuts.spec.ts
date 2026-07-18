import { describe, expect, it } from "vitest";
import { buildShortcutRows, defaultToggleLabel } from "../../src/lib/shortcuts/shortcuts";

describe("defaultToggleLabel", () => {
  it("returns the macOS label when mac is true", () => {
    expect(defaultToggleLabel(true)).toBe("⌘⇧Y");
  });

  it("returns the Ctrl label when mac is false", () => {
    expect(defaultToggleLabel(false)).toBe("Ctrl+Shift+Y");
  });
});

describe("buildShortcutRows", () => {
  it("uses ⌘ modifiers and the default toggle label on mac with no live binding", () => {
    const rows = buildShortcutRows({ mac: true, toggleKey: null });
    expect(rows).toEqual([
      { keys: "⌘⇧Y", action: "Toggle panel" },
      { keys: "⌘+/", action: "Search" },
      { keys: "Esc", action: "Close surface" },
    ]);
  });

  it("uses Ctrl modifiers and the default toggle label off mac with no live binding", () => {
    const rows = buildShortcutRows({ mac: false, toggleKey: null });
    expect(rows).toEqual([
      { keys: "Ctrl+Shift+Y", action: "Toggle panel" },
      { keys: "Ctrl+/", action: "Search" },
      { keys: "Esc", action: "Close surface" },
    ]);
  });

  it("uses a provided toggleKey to override the default in the Toggle panel row", () => {
    const rows = buildShortcutRows({ mac: true, toggleKey: "⌘⌥N" });
    expect(rows[0]).toEqual({ keys: "⌘⌥N", action: "Toggle panel" });
  });

  it("falls back to the default label when toggleKey is an empty string", () => {
    const rows = buildShortcutRows({ mac: false, toggleKey: "" });
    expect(rows[0]).toEqual({ keys: "Ctrl+Shift+Y", action: "Toggle panel" });
  });

  it("falls back to the default label when toggleKey is null", () => {
    const rows = buildShortcutRows({ mac: true, toggleKey: null });
    expect(rows[0]).toEqual({ keys: "⌘⇧Y", action: "Toggle panel" });
  });

  it("renders the Search row as ⌘+/ on mac and Ctrl+/ otherwise", () => {
    expect(buildShortcutRows({ mac: true, toggleKey: null })[1]).toEqual({ keys: "⌘+/", action: "Search" });
    expect(buildShortcutRows({ mac: false, toggleKey: null })[1]).toEqual({ keys: "Ctrl+/", action: "Search" });
  });

  it("renders the Close row as Esc on both platforms", () => {
    expect(buildShortcutRows({ mac: true, toggleKey: null })[2]).toEqual({ keys: "Esc", action: "Close surface" });
    expect(buildShortcutRows({ mac: false, toggleKey: null })[2]).toEqual({ keys: "Esc", action: "Close surface" });
  });
});
