import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'service-auth',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
      // Wired adapters / DTOs / module wiring aren't behavior; exclude
      // from the branch-coverage denominator so the percentage reflects
      // the security-critical surfaces we actually unit test here.
      exclude: [
        'src/index.ts',
        'src/auth.module.ts',
        'src/auth.controller.ts',
        'src/auth.types.ts',
        'src/dto/**',
        'src/guards/**',
        'src/ports/**',
        'src/internal/tokens.ts',
        'src/adapters/console-notification.adapter.ts',
      ],
    },
  },
});
