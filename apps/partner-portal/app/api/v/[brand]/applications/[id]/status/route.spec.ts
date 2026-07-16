import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { signDemoPreset, _resetDemoCookieKeyCache } from '../../../../../../../lib/demo-cookie';
import {
  applications as masterApplications,
  partners as masterPartners,
} from '../../../../../../../lib/master-data';

/**
 * F-001 — cross-tenant IDOR regression coverage for
 * GET /api/v/<brand>/applications/<id>/status.
 *
 * Pre-fix, requireSession just verified that any session existed and
 * the DB / synth lookup keyed on id alone. A signed-in MedPay merchant
 * could read a TradePay application by guessing the uuid. These tests
 * lock in the brand + partner scope and the 404-not-403 response so a
 * regression breaks the suite.
 */

function buildReq(brand: string, demoCookie?: string): NextRequest {
  const cookies: Record<string, string> = {};
  if (demoCookie) cookies.eazepay_demo = demoCookie;
  return {
    cookies: {
      get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
    },
    headers: new Headers(),
    nextUrl: new URL(`http://localhost/api/v/${brand}/applications/x/status`),
  } as unknown as NextRequest;
}

function pickSynthRow(brandSlug: 'medpay' | 'tradepay' | 'coachpay') {
  const product =
    brandSlug === 'medpay' ? 'med-pay' : brandSlug === 'tradepay' ? 'trade-pay' : 'coach-pay';
  const row = masterApplications.find((a) => a.product === product);
  if (!row) throw new Error(`no synth row for ${brandSlug}`);
  return row;
}

describe('GET /api/v/:brand/applications/:id/status — F-001 IDOR', () => {
  beforeEach(() => {
    _resetDemoCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    // Force the synth path — no DATABASE_URL in unit env.
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no session cookie present', async () => {
    const res = await GET(buildReq('medpay'), {
      params: Promise.resolve({ brand: 'medpay', id: 'a_001' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for unknown brand slug', async () => {
    const signed = await signDemoPreset('master', 60);
    const res = await GET(buildReq('attacker', signed), {
      params: Promise.resolve({ brand: 'attacker', id: 'a_001' }),
    });
    expect(res.status).toBe(400);
  });

  it('allows operator session to read any application via synth path', async () => {
    const signed = await signDemoPreset('master', 60);
    const row = pickSynthRow('medpay');
    const res = await GET(buildReq('medpay', signed), {
      params: Promise.resolve({ brand: 'medpay', id: row.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicationId).toBe(row.id);
    // F-001: source field must NOT leak storage path.
    expect(body.source).toBeUndefined();
  });

  it('F-001: brand-scoped demo cannot read a different brand id (returns 404)', async () => {
    // MedPay brand session attempting to read a TradePay synth row.
    const signed = await signDemoPreset('medpay', 60);
    const tradeRow = pickSynthRow('tradepay');
    const res = await GET(buildReq('medpay', signed), {
      params: Promise.resolve({ brand: 'medpay', id: tradeRow.id }),
    });
    // Brand-mismatch resolves to 404 (same as not-exists) — no oracle.
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('application_not_found');
  });

  it('F-001: cross-brand URL attempt by brand-scoped session is 404', async () => {
    // MedPay session probing /v/tradepay/... — allowed partner list for
    // tradepay is empty for a medpay-scoped session, so collapse to 404.
    const signed = await signDemoPreset('medpay', 60);
    const tradeRow = pickSynthRow('tradepay');
    const res = await GET(buildReq('tradepay', signed), {
      params: Promise.resolve({ brand: 'tradepay', id: tradeRow.id }),
    });
    expect(res.status).toBe(404);
  });

  it('F-001: unknown application id is 404 with the same body as cross-tenant', async () => {
    const signed = await signDemoPreset('master', 60);
    const res = await GET(buildReq('medpay', signed), {
      params: Promise.resolve({ brand: 'medpay', id: 'a_does_not_exist' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('application_not_found');
  });

  it('F-001: operator can still read a row whose partner is Multi-brand', async () => {
    const signed = await signDemoPreset('master', 60);
    const multiBrandPartner = masterPartners.find((p) => p.product === 'Multi-brand');
    if (!multiBrandPartner) return; // dataset variance
    const row = masterApplications.find((a) => a.partner === multiBrandPartner.legalName);
    if (!row) return;
    const brandFromProduct =
      row.product === 'med-pay' ? 'medpay' : row.product === 'trade-pay' ? 'tradepay' : 'coachpay';
    const res = await GET(buildReq(brandFromProduct, signed), {
      params: Promise.resolve({ brand: brandFromProduct, id: row.id }),
    });
    expect(res.status).toBe(200);
  });
});
