import { defineConfig } from 'vitest/config';

// Integration tests compile a Compute app and run it under Viceroy.
// Run them with `npm run test:integration`, which builds the app first.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
