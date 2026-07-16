import { describe, expect, it, vi } from "vitest";
import {
  CLOSE_PANEL_MESSAGE,
  connectPanelToBackground,
  type PanelOpener,
  PanelRegistry,
  TOGGLE_PANEL_COMMAND,
  togglePanelForCommand,
} from "../../src/lib/commands/panelToggle";

/** Panel opener spy; `reject` makes `open` reject to exercise error handling. */
function fakePanel(reject = false): PanelOpener & { open: ReturnType<typeof vi.fn> } {
  return {
    open: vi.fn(() => (reject ? Promise.reject(new Error("nope")) : Promise.resolve())),
  };
}

/** A registry with a fake port already registered for `windowId`. */
function registryWithOpen(windowId: number) {
  const registry = new PanelRegistry();
  const port = { postMessage: vi.fn() };
  registry.register(windowId, port);
  return { registry, port };
}

const tabIn = (windowId: number) => ({ windowId }) as chrome.tabs.Tab;

describe("togglePanelForCommand", () => {
  it("opens the panel in the command's window when it is closed", () => {
    const panel = fakePanel();
    togglePanelForCommand(TOGGLE_PANEL_COMMAND, tabIn(42), panel, new PanelRegistry());
    expect(panel.open).toHaveBeenCalledWith({ windowId: 42 });
  });

  it("closes the panel (and does not re-open) when it is already open", () => {
    const panel = fakePanel();
    const { registry, port } = registryWithOpen(42);
    togglePanelForCommand(TOGGLE_PANEL_COMMAND, tabIn(42), panel, registry);
    expect(port.postMessage).toHaveBeenCalledWith(CLOSE_PANEL_MESSAGE);
    expect(panel.open).not.toHaveBeenCalled();
  });

  it("toggles per-window: opens window 7 even while window 42 is open", () => {
    const panel = fakePanel();
    const { registry } = registryWithOpen(42);
    togglePanelForCommand(TOGGLE_PANEL_COMMAND, tabIn(7), panel, registry);
    expect(panel.open).toHaveBeenCalledWith({ windowId: 7 });
  });

  it("ignores unrelated commands", () => {
    const panel = fakePanel();
    togglePanelForCommand("some-other-command", tabIn(42), panel, new PanelRegistry());
    expect(panel.open).not.toHaveBeenCalled();
  });

  it("no-ops when no tab is provided", () => {
    const panel = fakePanel();
    togglePanelForCommand(TOGGLE_PANEL_COMMAND, undefined, panel, new PanelRegistry());
    expect(panel.open).not.toHaveBeenCalled();
  });

  it("no-ops when the tab has no windowId", () => {
    const panel = fakePanel();
    togglePanelForCommand(TOGGLE_PANEL_COMMAND, {} as chrome.tabs.Tab, panel, new PanelRegistry());
    expect(panel.open).not.toHaveBeenCalled();
  });

  it("swallows a rejected open without throwing", async () => {
    const panel = fakePanel(true);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => togglePanelForCommand(TOGGLE_PANEL_COMMAND, tabIn(1), panel, new PanelRegistry())).not.toThrow();
    // Let the rejected promise settle so the .catch runs.
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("PanelRegistry", () => {
  it("tracks open state per window and forgets on unregister", () => {
    const registry = new PanelRegistry();
    expect(registry.isOpen(1)).toBe(false);
    registry.register(1, { postMessage: vi.fn() });
    expect(registry.isOpen(1)).toBe(true);
    registry.unregister(1);
    expect(registry.isOpen(1)).toBe(false);
  });

  it("close() signals only the matching window's port", () => {
    const registry = new PanelRegistry();
    const a = { postMessage: vi.fn() };
    const b = { postMessage: vi.fn() };
    registry.register(1, a);
    registry.register(2, b);
    registry.close(1);
    expect(a.postMessage).toHaveBeenCalledWith(CLOSE_PANEL_MESSAGE);
    expect(b.postMessage).not.toHaveBeenCalled();
  });

  it("close() is a no-op for an unknown window", () => {
    const registry = new PanelRegistry();
    expect(() => registry.close(99)).not.toThrow();
  });
});

/** A fake client port capturing the message/disconnect listeners. */
function fakeClientPort() {
  let onMessage: (m: unknown) => void = () => {};
  let onDisconnect: () => void = () => {};
  return {
    postMessage: vi.fn(),
    onMessage: { addListener: (cb: (m: unknown) => void) => (onMessage = cb) },
    onDisconnect: { addListener: (cb: () => void) => (onDisconnect = cb) },
    emitMessage: (m: unknown) => onMessage(m),
    emitDisconnect: () => onDisconnect(),
  };
}

describe("connectPanelToBackground", () => {
  it("reports the host window id over a fresh port", async () => {
    const port = fakeClientPort();
    await connectPanelToBackground({
      connect: () => port,
      getWindowId: async () => 42,
      close: vi.fn(),
    });
    expect(port.postMessage).toHaveBeenCalledWith({ windowId: 42 });
  });

  it("closes the document on a close-panel message", async () => {
    const port = fakeClientPort();
    const close = vi.fn();
    await connectPanelToBackground({ connect: () => port, getWindowId: async () => 1, close });
    port.emitMessage(CLOSE_PANEL_MESSAGE);
    expect(close).toHaveBeenCalledOnce();
  });

  it("ignores unrelated port messages", async () => {
    const port = fakeClientPort();
    const close = vi.fn();
    await connectPanelToBackground({ connect: () => port, getWindowId: async () => 1, close });
    port.emitMessage({ type: "something-else" });
    expect(close).not.toHaveBeenCalled();
  });

  it("reconnects (new port) when the connection drops while still open", async () => {
    const ports = [fakeClientPort(), fakeClientPort()];
    const first = ports[0];
    const connect = vi.fn(() => ports.shift() ?? fakeClientPort());
    await connectPanelToBackground({ connect, getWindowId: async () => 5, close: vi.fn() });
    expect(connect).toHaveBeenCalledTimes(1);
    first.emitDisconnect();
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the host window id is unknown", async () => {
    const connect = vi.fn(() => fakeClientPort());
    await connectPanelToBackground({ connect, getWindowId: async () => undefined, close: vi.fn() });
    expect(connect).not.toHaveBeenCalled();
  });
});
