import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-notification',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',
        'src/**/*.controller.ts',
        'src/**/index.ts',
        'src/**/tokens.ts',
      ],
    },
  },
});
