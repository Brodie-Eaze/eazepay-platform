/**
 * Per-merchant billing configuration.
 *
 * Mirrors the AUREAN OS "Automation" tab: who gets billed, on what
 * cycle, on what day, with what payment-link template, and whether
 * the system should auto-send drafts the moment they're generated.
 *
 * Persistence: localStorage (same pattern as the rest of the
 * invoicing module — swap to a BFF endpoint later by re-implementing
 * the read/write surface).
 */

export type BillingCycle = 'monthly' | 'weekly' | 'paused';

export interface BillingConfig {
  partnerId: string;
  cycle: BillingCycle;
  /** Day of the month (1–28) for monthly cycle; day of the week (0=Sun) for weekly. */
  dayOfPeriod: number;
  /** Override the contact email for billing (defaults to partner.email if unset). */
  sendToEmail?: string;
  /** If true, generated drafts auto-flip to Sent + queue an email send. */
  autoSend: boolean;
  /**
   * Payment-link template. Accounts paste a Stripe / MICAMP /
   * payment-gateway URL here that the Send composer drops into the
   * email body as a "Pay invoice" CTA. Supports `{{amount}}` and
   * `{{invoice}}` placeholders for per-row substitution.
   */
  paymentLinkTemplate?: string;
  /** Operator note (rate-card discussion, special handling, etc.). */
  note?: string;
}

const STORE_KEY = 'eazepay_billing_configs_v1';

export const DEFAULT_CONFIG = (partnerId: string): BillingConfig => ({
  partnerId,
  cycle: 'monthly',
  dayOfPeriod: 1,
  autoSend: false,
});

function isCycle(v: unknown): v is BillingCycle {
  return v === 'monthly' || v === 'weekly' || v === 'paused';
}

export function readBillingConfigs(): Record<string, BillingConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, BillingConfig> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const c = v as Record<string, unknown>;
      if (typeof c.partnerId !== 'string' || !isCycle(c.cycle)) continue;
      const day = Number(c.dayOfPeriod);
      if (!Number.isFinite(day) || day < 0 || day > 31) continue;
      out[k] = {
        partnerId: c.partnerId,
        cycle: c.cycle,
        dayOfPeriod: Math.floor(day),
        sendToEmail: typeof c.sendToEmail === 'string' ? c.sendToEmail : undefined,
        autoSend: c.autoSend === true,
        paymentLinkTemplate:
          typeof c.paymentLinkTemplate === 'string' ? c.paymentLinkTemplate : undefined,
        note: typeof c.note === 'string' ? c.note : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function setBillingConfig(config: BillingConfig): void {
  if (typeof window === 'undefined' || !config.partnerId) return;
  const next = readBillingConfigs();
  next[config.partnerId] = config;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* swallow */
  }
}

export function getBillingConfig(partnerId: string): BillingConfig {
  const all = readBillingConfigs();
  return all[partnerId] ?? DEFAULT_CONFIG(partnerId);
}

/**
 * Fill `{{amount}}` / `{{invoice}}` placeholders inside the payment-
 * link template. Returns undefined if no template is configured.
 */
export function resolvePaymentLink(
  template: string | undefined,
  vars: { amountCents: number; invoiceNo: string },
): string | undefined {
  if (!template) return undefined;
  const amount = (vars.amountCents / 100).toFixed(2);
  return template
    .replace(/\{\{amount\}\}/g, amount)
    .replace(/\{\{invoice\}\}/g, encodeURIComponent(vars.invoiceNo));
}
