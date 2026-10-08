import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests run in Node, where the fastly:* modules don't exist,
// so they are aliased to in-memory fakes.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^fastly:(.*)$/,
        replacement: fileURLToPath(new URL('./test/unit/fakes/$1.ts', import.meta.url)),
      },
    ],
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
    },
  },
});
