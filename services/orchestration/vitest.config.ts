import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-orchestration',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
  },
});
