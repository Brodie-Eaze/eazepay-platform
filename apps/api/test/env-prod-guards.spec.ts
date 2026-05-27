import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PE-KEK-01 + PE-AUDIT-01 — production boot guards.
 *
 * The env schema must REFUSE TO LOAD when NODE_ENV=production and
 * either KEY_MANAGER is not 'kms' or AUDIT_SINK is not 's3'.
 *
 * loadEnv() caches the parsed result module-globally. Each test
 * reloads via dynamic import + Vite's `?bust=` query so the cache
 * is fresh per case.
 */
describe('production env guards', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Start each test from a minimal valid baseline. JWT secret must
    // be ≥32 chars per the schema; everything else has a sane default.
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
      CORS_ALLOWED_ORIGINS: 'https://app.eazepay.com',
      ESIGN_PROVIDER: 'docusign',
      KEY_MANAGER: 'kms',
      AUDIT_SINK: 's3',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const loadFresh = async () => {
    // vi.resetModules() clears the module cache so the module-global
    // `cached` inside loadEnv() is fresh per-test. Static import keeps
    // Vite happy (dynamic-import path templates are restricted).
    vi.resetModules();
    const mod = await import('../src/config/env.js');
    return mod.loadEnv as () => unknown;
  };

  it('boots with KEY_MANAGER=kms + AUDIT_SINK=s3 in production', async () => {
    const loadEnv = await loadFresh();
    expect(() => loadEnv()).not.toThrow();
  });

  it('refuses boot when KEY_MANAGER=local in production', async () => {
    process.env.KEY_MANAGER = 'local';
    process.env.LOCAL_KEK_HEX = 'a'.repeat(64);
    const loadEnv = await loadFresh();
    expect(() => loadEnv()).toThrow(/Environment validation failed/);
  });

  it('refuses boot when AUDIT_SINK=local-fs in production', async () => {
    process.env.AUDIT_SINK = 'local-fs';
    const loadEnv = await loadFresh();
    expect(() => loadEnv()).toThrow(/Environment validation failed/);
  });

  it('refuses boot when AUDIT_SINK=dynamodb in production', async () => {
    // DynamoDB alone is not WORM and no longer satisfies SOC2 CC7.2.
    process.env.AUDIT_SINK = 'dynamodb';
    const loadEnv = await loadFresh();
    expect(() => loadEnv()).toThrow(/Environment validation failed/);
  });

  it('allows KEY_MANAGER=local in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.KEY_MANAGER = 'local';
    process.env.LOCAL_KEK_HEX = 'a'.repeat(64);
    process.env.AUDIT_SINK = 'local-fs';
    process.env.ESIGN_PROVIDER = 'mock';
    delete process.env.CORS_ALLOWED_ORIGINS;
    const loadEnv = await loadFresh();
    expect(() => loadEnv()).not.toThrow();
  });
});
