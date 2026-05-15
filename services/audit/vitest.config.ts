import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'service-audit', include: ['test/**/*.spec.ts'], environment: 'node' },
});
