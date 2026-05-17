import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-email',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
  },
});
