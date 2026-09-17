import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Explicit imports (`import { it } from 'vitest'`) instead of injected globals: the test
    // files stay plain TypeScript, and nothing depends on ambient types being configured.
    globals: false,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
