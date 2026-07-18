import { describe, expect, it } from "vitest";
import { nextSurface } from "../../src/lib/ui/surfaces";

describe("nextSurface", () => {
  it("opens a surface from nothing", () => {
    expect(nextSurface(null, "dropdown", true)).toBe("dropdown");
  });

  it("opening one surface closes the other", () => {
    expect(nextSurface("dropdown", "settings", true)).toBe("settings");
  });

  it("closing the active surface clears it", () => {
    expect(nextSurface("settings", "settings", false)).toBeNull();
  });

  it("closing a non-active surface leaves the current one (double-fire guard)", () => {
    expect(nextSurface("dropdown", "settings", false)).toBe("dropdown");
  });

  it("search participates like any other surface", () => {
    expect(nextSurface("search", "search", false)).toBeNull();
    expect(nextSurface("search", "settings", true)).toBe("settings");
  });
});
