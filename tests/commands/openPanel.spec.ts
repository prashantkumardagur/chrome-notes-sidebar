import { describe, expect, it, vi } from "vitest";
import { OPEN_PANEL_COMMAND, openPanelForCommand, type PanelOpener } from "../../src/lib/commands/openPanel";

/** Panel opener spy; `reject` makes `open` reject to exercise error handling. */
function fakePanel(reject = false): PanelOpener & { open: ReturnType<typeof vi.fn> } {
  return {
    open: vi.fn(() => (reject ? Promise.reject(new Error("nope")) : Promise.resolve())),
  };
}

const tabIn = (windowId: number) => ({ windowId }) as chrome.tabs.Tab;

describe("openPanelForCommand", () => {
  it("opens the panel in the command's window", () => {
    const panel = fakePanel();
    openPanelForCommand(OPEN_PANEL_COMMAND, tabIn(42), panel);
    expect(panel.open).toHaveBeenCalledWith({ windowId: 42 });
  });

  it("ignores unrelated commands", () => {
    const panel = fakePanel();
    openPanelForCommand("some-other-command", tabIn(42), panel);
    expect(panel.open).not.toHaveBeenCalled();
  });

  it("no-ops when no tab is provided", () => {
    const panel = fakePanel();
    openPanelForCommand(OPEN_PANEL_COMMAND, undefined, panel);
    expect(panel.open).not.toHaveBeenCalled();
  });

  it("no-ops when the tab has no windowId", () => {
    const panel = fakePanel();
    openPanelForCommand(OPEN_PANEL_COMMAND, {} as chrome.tabs.Tab, panel);
    expect(panel.open).not.toHaveBeenCalled();
  });

  it("swallows a rejected open without throwing", async () => {
    const panel = fakePanel(true);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => openPanelForCommand(OPEN_PANEL_COMMAND, tabIn(1), panel)).not.toThrow();
    // Let the rejected promise settle so the .catch runs.
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
