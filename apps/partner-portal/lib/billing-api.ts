/**
 * Typed fetch client for the billing BFF.
 *
 * Design notes:
 *   - Reads `NEXT_PUBLIC_API_URL` at runtime (Next.js inlines it at
 *     build, fallback to localhost dev).
 *   - Bearer token comes from a cookie set by the existing sign-in
 *     flow (cookie name is `eaze_access`, same as the rest of the
 *     portal).
 *   - All responses are bigint-safe JSON (server emits cents as
 *     strings; client converts on the boundary).
 *   - On any error the caller can fall back to localStorage adapters
 *     in `lib/invoicing.ts` / `lib/billing-config.ts` so the demo
 *     keeps working in offline / no-API mode.
 */

const API_BASE = (() => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  return (
    (window as unknown as { __EAZE_API__?: string }).__EAZE_API__ ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3000'
  );
})();

function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)eaze_access=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

export class BillingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: unknown,
  ) {
    super(`billing-api ${status}`);
    this.name = 'BillingApiError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new BillingApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function idem(): string {
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ─── Types ──────────────────────────────────────────────────── */

export type ApiInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'voided';
export type ApiBillingCycle = 'monthly' | 'weekly' | 'paused';
export type ApiPaymentMethod = 'ach' | 'wire' | 'card' | 'check' | 'other';

export interface ApiBillingConfig {
  merchantId: string;
  merchantName: string;
  cycle: ApiBillingCycle;
  dayOfPeriod: number;
  autoSend: boolean;
  sendToEmail: string | null;
  paymentLinkTemplate: string | null;
  note: string | null;
  updatedAt: string;
}

export interface ApiInvoice {
  id: string;
  invoiceNo: string;
  merchantId: string;
  merchant: string;
  vertical: string | null;
  periodId: string;
  periodLabel: string;
  /** Cents as string (BigInt-safe). */
  grossFundedCents: string;
  feeBps: number;
  amountCents: string;
  paidCents: string;
  status: ApiInvoiceStatus;
  dueDate: string;
  voided: boolean;
  voidReason: string | null;
}

export interface ApiGeneratePreview {
  periodId: string;
  toCreate: number;
  alreadyExists: number;
  paused: number;
  totalFeeCents: string;
  perMerchant: Array<{
    merchantId: string;
    merchant: string;
    grossFundedCents: string;
    feeAmountCents: string;
    alreadyExists: boolean;
    paused: boolean;
  }>;
}

/* ─── Endpoints ──────────────────────────────────────────────── */

export const BillingApi = {
  // Configs
  listConfigs: () => request<ApiBillingConfig[]>('/billing/configs'),
  patchConfig: (
    merchantId: string,
    patch: Partial<{
      cycle: ApiBillingCycle;
      dayOfPeriod: number;
      sendToEmail: string;
      autoSend: boolean;
      paymentLinkTemplate: string;
      note: string;
    }>,
  ) =>
    request<{ id: string; merchantId: string }>(`/billing/configs/${merchantId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
      idempotencyKey: idem(),
    }),

  // Generate
  previewGenerate: (periodId: string) =>
    request<ApiGeneratePreview>(
      `/billing/generate/preview?periodId=${encodeURIComponent(periodId)}`,
    ),
  runGenerate: (periodId: string) =>
    request<{ created: string[]; skipped: { paused: number; existing: number } }>(
      `/billing/generate`,
      {
        method: 'POST',
        body: JSON.stringify({ periodId }),
        idempotencyKey: idem(),
      },
    ),

  // Invoice queries
  listInvoices: (q: {
    periodId?: string;
    status?: ApiInvoiceStatus;
    merchantId?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (q.periodId) params.set('periodId', q.periodId);
    if (q.status) params.set('status', q.status);
    if (q.merchantId) params.set('merchantId', q.merchantId);
    if (q.limit) params.set('limit', String(q.limit));
    return request<ApiInvoice[]>(`/billing/invoices?${params.toString()}`);
  },
  getInvoice: (invoiceNo: string) =>
    request<unknown>(`/billing/invoices/${encodeURIComponent(invoiceNo)}`),

  // Mutations
  setStatus: (invoiceNo: string, status: 'draft' | 'sent' | 'paid' | 'overdue') =>
    request(`/billing/invoices/${encodeURIComponent(invoiceNo)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      idempotencyKey: idem(),
    }),
  setFeePct: (invoiceNo: string, feePct: number) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceNo)}/fee-pct`, {
      method: 'PATCH',
      body: JSON.stringify({ feePct }),
      idempotencyKey: idem(),
    }),
  setAmount: (invoiceNo: string, amountCents: number) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceNo)}/amount`, {
      method: 'PATCH',
      body: JSON.stringify({ amountCents }),
      idempotencyKey: idem(),
    }),
  setDueDate: (invoiceNo: string, dueDate: string) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceNo)}/due-date`, {
      method: 'PATCH',
      body: JSON.stringify({ dueDate }),
      idempotencyKey: idem(),
    }),
  voidInvoice: (invoiceNo: string, reason: string) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceNo)}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      idempotencyKey: idem(),
    }),
  unvoidInvoice: (invoiceNo: string) =>
    request(`/billing/invoices/${encodeURIComponent(invoiceNo)}/unvoid`, {
      method: 'POST',
      body: JSON.stringify({}),
      idempotencyKey: idem(),
    }),
  recordPayment: (
    invoiceNo: string,
    body: {
      amountCents: number;
      paidAt: string;
      method: ApiPaymentMethod;
      reference?: string;
      note?: string;
      markPaid?: boolean;
    },
  ) =>
    request<{ paymentId: string; autoFlippedPaid: boolean }>(
      `/billing/invoices/${encodeURIComponent(invoiceNo)}/payments`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        idempotencyKey: idem(),
      },
    ),
  mintConfirmToken: (invoiceNo: string) =>
    request<{ token: string; expiresAt: string }>(
      `/billing/invoices/${encodeURIComponent(invoiceNo)}/confirm-token`,
      {
        method: 'POST',
        body: JSON.stringify({ invoiceNo }),
        idempotencyKey: idem(),
      },
    ),

  // Public confirm/dispute (no auth)
  resolveConfirmToken: (token: string) =>
    request<{
      state: 'pending' | 'confirmed' | 'disputed';
      disputeReason: string | null;
      invoice: {
        invoiceNo: string;
        merchant: string;
        vertical: string | null;
        periodLabel: string;
        grossFundedCents: string;
        feeBps: number;
        amountCents: string;
        dueDate: string;
      };
    }>(`/public/billing/confirm/${encodeURIComponent(token)}`),
  applyConfirmDecision: (token: string, decision: 'confirm' | 'dispute', reason?: string) =>
    request<{ state: 'confirmed' | 'disputed' }>(
      `/public/billing/confirm/${encodeURIComponent(token)}`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      },
    ),
} as const;

/**
 * Probe the API once per session. Used by lib/invoicing.ts to decide
 * whether to call the API or fall back to localStorage adapters.
 */
let apiAvailable: boolean | null = null;
export async function isBillingApiAvailable(): Promise<boolean> {
  if (apiAvailable !== null) return apiAvailable;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${API_BASE}/health/liveness`, {
      signal: ctrl.signal,
    });
    apiAvailable = res.ok;
  } catch {
    apiAvailable = false;
  }
  return apiAvailable;
}
