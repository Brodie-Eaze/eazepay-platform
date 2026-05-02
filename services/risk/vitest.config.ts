import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'service-risk', include: ['test/**/*.spec.ts'], environment: 'node' },
});
