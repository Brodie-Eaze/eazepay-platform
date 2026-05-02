import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared-types',
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    environment: 'node',
  },
});
