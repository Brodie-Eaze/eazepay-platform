import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'service-webhook', include: ['test/**/*.spec.ts'], environment: 'node' },
});
