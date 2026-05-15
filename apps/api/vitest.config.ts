import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    environment: 'node',
  },
});
