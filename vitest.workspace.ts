import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'libs/*/vitest.config.ts',
  'services/*/vitest.config.ts',
  'apps/api/vitest.config.ts',
]);
