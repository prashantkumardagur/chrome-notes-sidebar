import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import manifest from "./src/manifest.config";

export default defineConfig({
  plugins: [svelte(), crx({ manifest })],
  // CRXJS serves extension pages over the dev server; allow the extension origin.
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
});
