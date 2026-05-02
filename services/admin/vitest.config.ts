import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'service-admin', include: ['test/**/*.spec.ts'], environment: 'node' },
});
