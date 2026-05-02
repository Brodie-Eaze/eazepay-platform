import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-payment',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
  },
});
