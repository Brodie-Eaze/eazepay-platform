import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integrations-core',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
