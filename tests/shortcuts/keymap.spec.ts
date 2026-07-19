import { describe, expect, it } from "vitest";
import { BINDINGS, matchShortcut } from "../../src/lib/shortcuts/keymap";

/** Build the KeyboardEvent-shaped subset matchShortcut reads. */
function evt(code: string, mods: { shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean } = {}) {
  return {
    code,
    shiftKey: mods.shift ?? false,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
  };
}

describe("matchShortcut", () => {
  it("resolves every binding with metaKey and (separately) with ctrlKey", () => {
    for (const b of BINDINGS) {
      expect(matchShortcut(evt(b.code, { shift: b.shift, meta: true }))).toBe(b.action);
      expect(matchShortcut(evt(b.code, { shift: b.shift, ctrl: true }))).toBe(b.action);
    }
  });

  it("discriminates Comma on Shift: settings vs previous note", () => {
    expect(matchShortcut(evt("Comma", { meta: true, shift: false }))).toBe("toggle-settings");
    expect(matchShortcut(evt("Comma", { meta: true, shift: true }))).toBe("prev-note");
  });

  it("discriminates Period on Shift: info vs next note", () => {
    expect(matchShortcut(evt("Period", { meta: true, shift: false }))).toBe("toggle-info");
    expect(matchShortcut(evt("Period", { meta: true, shift: true }))).toBe("next-note");
  });

  it("maps the remaining bindings", () => {
    expect(matchShortcut(evt("Slash", { meta: true }))).toBe("toggle-search");
    expect(matchShortcut(evt("KeyE", { meta: true, shift: true }))).toBe("toggle-view");
    expect(matchShortcut(evt("KeyA", { meta: true, shift: true }))).toBe("new-note");
    expect(matchShortcut(evt("KeyR", { meta: true, shift: true }))).toBe("rename-note");
    expect(matchShortcut(evt("Backspace", { meta: true, shift: true }))).toBe("delete-note");
  });

  it("requires Shift for delete-note: Cmd+Backspace alone is not bound", () => {
    expect(matchShortcut(evt("Backspace", { meta: true, shift: false }))).toBeNull();
  });

  it("requires Shift for rename-note: Cmd+R alone is not bound", () => {
    expect(matchShortcut(evt("KeyR", { meta: true, shift: false }))).toBeNull();
  });

  it("returns null when neither meta nor ctrl is held", () => {
    expect(matchShortcut(evt("Slash", {}))).toBeNull();
    expect(matchShortcut(evt("KeyE", { shift: true }))).toBeNull();
  });

  it("returns null when altKey is held", () => {
    expect(matchShortcut(evt("Slash", { meta: true, alt: true }))).toBeNull();
    expect(matchShortcut(evt("Comma", { ctrl: true, alt: true }))).toBeNull();
  });

  it("returns null when Shift state does not match the binding", () => {
    // Slash is a no-Shift binding; Cmd+Shift+/ is not one of ours.
    expect(matchShortcut(evt("Slash", { meta: true, shift: true }))).toBeNull();
    // KeyE requires Shift; Cmd+E alone is not bound.
    expect(matchShortcut(evt("KeyE", { meta: true, shift: false }))).toBeNull();
  });

  it("returns null for an unmapped code", () => {
    expect(matchShortcut(evt("KeyB", { meta: true }))).toBeNull();
    expect(matchShortcut(evt("KeyZ", { ctrl: true }))).toBeNull();
  });
});
