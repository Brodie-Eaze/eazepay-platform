import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@prisma/client': resolve(__dirname, 'test/_stubs/prisma-client.ts'),
    },
  },
  test: {
    name: 'service-compliance-doc',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',
        'src/**/index.ts',
        'src/**/tokens.ts',
        'src/**/*.types.ts',
      ],
    },
  },
});
