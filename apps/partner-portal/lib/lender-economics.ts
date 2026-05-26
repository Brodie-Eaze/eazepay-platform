/**
 * Per-lender commercial + integration metadata.
 *
 * Keyed by `MarketplaceLenderRow.id`. Holds the data that doesn't
 * belong in the catalogue row itself:
 *   • Kickback economics (the origination fee we earn per funded loan)
 *   • API integration health (last sync, error rate, latency)
 *   • Webhook config (URL we POST to, secret status)
 *   • Internal commercial notes (sales-team context, exclusivity terms)
 *
 * Replaced by the `lenders` DB table once the platform goes live; for
 * now this fixture is the source of truth for the per-lender detail
 * page at `/lender-marketplace/[id]`.
 */

import { marketplaceLenders, type MarketplaceLenderRow } from './marketplace-data';

export type ApiHealth = 'healthy' | 'degraded' | 'down' | 'unwired';

export interface LenderEconomics {
  /** Origination kickback in basis points of funded amount.
   * 250 = 2.5% of every funded loan returned to us. */
  kickbackBps: number;
  /** Per-funded-loan flat fee in cents, on top of the bps. */
  perLoanFeeCents: number;
  /** Exclusivity carve-out — text description if applicable. */
  exclusivityTerms: string | null;
  /** Volume tier bonuses, if any. JSON-ish for now. */
  volumeBonus: string | null;
}

export interface LenderIntegration {
  apiHealth: ApiHealth;
  lastSyncAt: string | null;
  /** P95 latency in milliseconds across the last 1k quote calls. */
  p95LatencyMs: number | null;
  /** Error rate as a fraction across the last 1k quote calls. */
  errorRate: number | null;
  webhookUrl: string | null;
  webhookSecretConfigured: boolean;
}

export interface LenderNotes {
  ownerInternal: string;
  ownerExternal: string | null;
  exclusivityTerms: string | null;
  /** Free-form sales-team context, surfaced in the admin detail page. */
  freeform: string | null;
}

export interface LenderDossier {
  lender: MarketplaceLenderRow;
  economics: LenderEconomics;
  integration: LenderIntegration;
  notes: LenderNotes;
}

/* ---------- per-lender records ---------- */

const ECONOMICS: Record<string, Partial<LenderEconomics & LenderIntegration & LenderNotes>> = {
  ml_eng_helia_med: {
    kickbackBps: 280,
    perLoanFeeCents: 0,
    apiHealth: 'healthy',
    lastSyncAt: '2026-05-26T03:14:00Z',
    p95LatencyMs: 412,
    errorRate: 0.003,
    webhookUrl: 'https://api.helia.health/webhooks/eazepay',
    webhookSecretConfigured: true,
    ownerInternal: 'Steven (Trutopia)',
    ownerExternal: 'Marc Tessier @ Helia',
  },
  ml_eng_sageheal: {
    kickbackBps: 220,
    perLoanFeeCents: 500,
    apiHealth: 'healthy',
    lastSyncAt: '2026-05-26T03:14:00Z',
    p95LatencyMs: 689,
    errorRate: 0.011,
    webhookUrl: 'https://api.sageheal.com/webhooks/eazepay',
    webhookSecretConfigured: true,
    ownerInternal: 'Steven (Trutopia)',
  },
  ml_eng_orion_trade: {
    kickbackBps: 195,
    perLoanFeeCents: 0,
    apiHealth: 'healthy',
    lastSyncAt: '2026-05-26T03:14:00Z',
    p95LatencyMs: 528,
    errorRate: 0.005,
    webhookUrl: 'https://api.orioncap.com/webhooks/eazepay',
    webhookSecretConfigured: true,
    ownerInternal: 'Brodie',
  },
  ml_eng_kestrel_trade: {
    kickbackBps: 240,
    perLoanFeeCents: 0,
    apiHealth: 'degraded',
    lastSyncAt: '2026-05-25T18:42:00Z',
    p95LatencyMs: 1842,
    errorRate: 0.043,
    webhookUrl: 'https://api.kestrelfin.com/webhooks/eazepay',
    webhookSecretConfigured: true,
    ownerInternal: 'Brodie',
    freeform: 'Latency creep over last 14d. Open ticket #8214 with their integrations team.',
  },
  ml_eng_atlas_coach: {
    kickbackBps: 310,
    perLoanFeeCents: 0,
    apiHealth: 'healthy',
    lastSyncAt: '2026-05-26T03:14:00Z',
    p95LatencyMs: 357,
    errorRate: 0.002,
    webhookUrl: 'https://api.atlas-cap.com/webhooks/eazepay',
    webhookSecretConfigured: true,
    ownerInternal: 'Brodie',
  },
  ml_eng_clearpath_coach: {
    kickbackBps: 260,
    perLoanFeeCents: 250,
    apiHealth: 'healthy',
    lastSyncAt: '2026-05-26T03:14:00Z',
    p95LatencyMs: 482,
    errorRate: 0.008,
    webhookUrl: 'https://api.clearpath-ed.com/webhooks/eazepay',
    webhookSecretConfigured: true,
    ownerInternal: 'Brodie',
  },
  ml_eng_summit_premier: {
    kickbackBps: 175,
    perLoanFeeCents: 0,
    apiHealth: 'healthy',
    lastSyncAt: '2026-05-26T03:14:00Z',
    p95LatencyMs: 612,
    errorRate: 0.004,
    webhookUrl: 'https://api.summit-premier.com/webhooks/eazepay',
    webhookSecretConfigured: true,
    ownerInternal: 'Brodie',
  },
  ml_in_buzzpay: {
    kickbackBps: 0, // we are BuzzPay — no kickback, we earn full lender economics
    perLoanFeeCents: 0,
    apiHealth: 'unwired',
    lastSyncAt: null,
    p95LatencyMs: null,
    errorRate: null,
    webhookUrl: null,
    webhookSecretConfigured: false,
    ownerInternal: 'Brodie + Tim/Steven (Trutopia)',
    freeform:
      'House lender — Phase 2 capitalization required ($2M-$5M debt facility) before live. Becomes cross-vertical default lender post tape-proof.',
  },
  ml_in_us_bank: {
    kickbackBps: 320,
    perLoanFeeCents: 0,
    apiHealth: 'unwired',
    lastSyncAt: null,
    p95LatencyMs: null,
    errorRate: null,
    webhookUrl: null,
    webhookSecretConfigured: false,
    ownerInternal: 'Kevin',
    freeform: 'Demo-gated. Awaiting EazePay demo → NDA → API docs.',
  },
  ml_in_engine_tech: {
    kickbackBps: 290,
    perLoanFeeCents: 0,
    apiHealth: 'unwired',
    lastSyncAt: null,
    p95LatencyMs: null,
    errorRate: null,
    webhookUrl: null,
    webhookSecretConfigured: false,
    ownerInternal: 'Kevin',
    freeform: 'Engine.tech (MoneyLion). Meeting not yet booked.',
  },
  ml_in_queen_street: {
    kickbackBps: 240,
    perLoanFeeCents: 0,
    apiHealth: 'unwired',
    lastSyncAt: null,
    p95LatencyMs: null,
    errorRate: null,
    webhookUrl: null,
    webhookSecretConfigured: false,
    ownerInternal: 'Brodie',
    freeform:
      'QuinStreet. Loan API in hand via Tim @ Trutopia referral. Currently being plugged into Salesforce as a near-prime / card-stacking lane.',
  },
};

const DEFAULT_ECONOMICS: LenderEconomics = {
  kickbackBps: 200,
  perLoanFeeCents: 0,
  exclusivityTerms: null,
  volumeBonus: null,
};

const DEFAULT_INTEGRATION: LenderIntegration = {
  apiHealth: 'unwired',
  lastSyncAt: null,
  p95LatencyMs: null,
  errorRate: null,
  webhookUrl: null,
  webhookSecretConfigured: false,
};

const DEFAULT_NOTES: LenderNotes = {
  ownerInternal: 'Unassigned',
  ownerExternal: null,
  exclusivityTerms: null,
  freeform: null,
};

export function getLenderDossier(lenderId: string): LenderDossier | null {
  const lender = marketplaceLenders.find((l) => l.id === lenderId);
  if (!lender) return null;
  const overrides = ECONOMICS[lenderId] ?? {};
  return {
    lender,
    economics: {
      ...DEFAULT_ECONOMICS,
      kickbackBps: overrides.kickbackBps ?? DEFAULT_ECONOMICS.kickbackBps,
      perLoanFeeCents: overrides.perLoanFeeCents ?? DEFAULT_ECONOMICS.perLoanFeeCents,
      exclusivityTerms: overrides.exclusivityTerms ?? DEFAULT_ECONOMICS.exclusivityTerms,
      volumeBonus: overrides.volumeBonus ?? DEFAULT_ECONOMICS.volumeBonus,
    },
    integration: {
      ...DEFAULT_INTEGRATION,
      apiHealth: overrides.apiHealth ?? DEFAULT_INTEGRATION.apiHealth,
      lastSyncAt: overrides.lastSyncAt ?? DEFAULT_INTEGRATION.lastSyncAt,
      p95LatencyMs: overrides.p95LatencyMs ?? DEFAULT_INTEGRATION.p95LatencyMs,
      errorRate: overrides.errorRate ?? DEFAULT_INTEGRATION.errorRate,
      webhookUrl: overrides.webhookUrl ?? DEFAULT_INTEGRATION.webhookUrl,
      webhookSecretConfigured:
        overrides.webhookSecretConfigured ?? DEFAULT_INTEGRATION.webhookSecretConfigured,
    },
    notes: {
      ...DEFAULT_NOTES,
      ownerInternal: overrides.ownerInternal ?? DEFAULT_NOTES.ownerInternal,
      ownerExternal: overrides.ownerExternal ?? DEFAULT_NOTES.ownerExternal,
      exclusivityTerms: overrides.exclusivityTerms ?? DEFAULT_NOTES.exclusivityTerms,
      freeform: overrides.freeform ?? DEFAULT_NOTES.freeform,
    },
  };
}

export function listAllDossiers(): LenderDossier[] {
  return marketplaceLenders.map((l) => getLenderDossier(l.id)!);
}
