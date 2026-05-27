import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'service-merchant', include: ['test/**/*.spec.ts'], environment: 'node' },
});
