import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-lender',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.module.ts', 'src/**/index.ts', 'src/**/tokens.ts', 'src/**/*.types.ts'],
    },
  },
});
