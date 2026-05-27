import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-user',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/internal/tokens.ts',
        'src/dto/**',
        'src/**/*.module.ts',
        'src/**/*.controller.ts',
      ],
      thresholds: { branches: 50, lines: 0, functions: 0, statements: 0 },
    },
  },
});
