import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/index.ts',
        'src/react/index.ts',
      ],
      // CI fails on regression below these aggregate thresholds. Core has
      // to stay at 95%+; the React adapter targets 90%+. Branch coverage is
      // held a hair lower because a few defensive `typeof globalThis` and
      // `console.debug ?? console.log` fallbacks are effectively
      // unreachable in the jsdom test environment.
      thresholds: {
        'src/*.ts': {
          statements: 95,
          functions: 95,
          lines: 95,
          branches: 88,
        },
        'src/react/**': {
          statements: 90,
          functions: 90,
          lines: 90,
          branches: 85,
        },
      },
    },
  },
});
