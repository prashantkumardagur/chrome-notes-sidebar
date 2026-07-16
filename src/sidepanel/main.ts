import { mount } from "svelte";
import { connectPanelToBackground, PANEL_PORT_NAME } from "../lib/commands/panelToggle";
import App from "./App.svelte";
import "./app.css";

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app mount point");

const app = mount(App, { target });

// Let the toggle shortcut find + close this panel (see lib/commands/panelToggle).
connectPanelToBackground({
  connect: () => chrome.runtime.connect({ name: PANEL_PORT_NAME }),
  getWindowId: async () => (await chrome.windows.getCurrent()).id,
  close: () => window.close(),
});

export default app;
