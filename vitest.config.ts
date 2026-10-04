import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    exclude: ['tests/dedupEngine.test.js', 'tests/pnlEngine.test.js', 'node_modules'],
  },
});
