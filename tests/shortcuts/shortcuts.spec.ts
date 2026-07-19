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
  it("uses ⌘ glyphs and the default toggle label on mac with no live binding", () => {
    const rows = buildShortcutRows({ mac: true, toggleKey: null });
    expect(rows).toEqual([
      { keys: "⌘⇧Y", action: "Toggle panel" },
      { keys: "⌘/", action: "Search" },
      { keys: "⌘⇧E", action: "Toggle Edit/View" },
      { keys: "⌘,", action: "Settings" },
      { keys: "⌘.", action: "Info" },
      { keys: "⌘⇧A", action: "New note" },
      { keys: "⌘⇧,", action: "Previous note" },
      { keys: "⌘⇧.", action: "Next note" },
      { keys: "Esc", action: "Close surface" },
    ]);
  });

  it("uses Ctrl+ prefixes and the default toggle label off mac with no live binding", () => {
    const rows = buildShortcutRows({ mac: false, toggleKey: null });
    expect(rows).toEqual([
      { keys: "Ctrl+Shift+Y", action: "Toggle panel" },
      { keys: "Ctrl+/", action: "Search" },
      { keys: "Ctrl+Shift+E", action: "Toggle Edit/View" },
      { keys: "Ctrl+,", action: "Settings" },
      { keys: "Ctrl+.", action: "Info" },
      { keys: "Ctrl+Shift+A", action: "New note" },
      { keys: "Ctrl+Shift+,", action: "Previous note" },
      { keys: "Ctrl+Shift+.", action: "Next note" },
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

  it("keeps the Close row as Esc on both platforms", () => {
    const mac = buildShortcutRows({ mac: true, toggleKey: null });
    const other = buildShortcutRows({ mac: false, toggleKey: null });
    expect(mac.at(-1)).toEqual({ keys: "Esc", action: "Close surface" });
    expect(other.at(-1)).toEqual({ keys: "Esc", action: "Close surface" });
  });

  it("gives every row a distinct action label (used as the render key)", () => {
    const actions = buildShortcutRows({ mac: true, toggleKey: null }).map((r) => r.action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});
