import { defineConfig } from 'vitest/config';

// Standalone test config: intentionally does NOT load the CRXJS build plugin,
// so unit tests run against plain modules with a jsdom DOM (needed by DOMPurify).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.ts'],
  },
});
