import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      DATABASE_PATH: './data/test-rag-chatbot.db',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,js}'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});
