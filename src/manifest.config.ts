import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Notes Sidebar",
  version: pkg.version,
  description: "Write Markdown notes in the Chrome side panel — synced across your browsers.",
  action: {
    default_title: "Open Notes Sidebar",
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
    },
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  commands: {
    // Keep the id in sync with TOGGLE_PANEL_COMMAND in src/lib/commands/panelToggle.ts.
    "open-panel": {
      suggested_key: {
        default: "Ctrl+Shift+Y",
        mac: "Command+Shift+Y",
      },
      description: "Toggle Notes Sidebar",
    },
  },
  permissions: ["storage", "sidePanel"],
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
});
