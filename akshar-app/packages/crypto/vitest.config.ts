import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/mobile-provider.ts'],
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 95,
      },
    },
  },
});
