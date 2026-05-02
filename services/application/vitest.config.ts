import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-application',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
  },
});
