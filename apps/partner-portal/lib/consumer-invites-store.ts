/**
 * Partner-scoped CONSUMER invite store.
 *
 * Distinct from the operator-scoped `invites-store.ts` which tracks
 * onboarding invites Brodie mints from `/onboarding-pipeline` for new
 * partner BUSINESSES. This one tracks links a salesperson at an
 * already-approved partner (e.g. Helio Dental Group on MedPay) sends
 * to a CONSUMER so the consumer can apply for financing.
 *
 * Persisted to `.next/consumer-invites.json` (best-effort, same MVP
 * pattern as the operator-side store). The map in module scope is the
 * authoritative read path during a single Next.js server lifetime.
 *
 * Schema:
 *   token              uuid              — also the URL `?invite=` query
 *   partnerId          'p_helio' etc.    — master-data partner id
 *   brand              'medpay'|...      — vertical brand slug
 *   salespersonEmail   string            — who minted the link
 *   consumer*          optional prefill  — name/email/phone
 *   loanAmountCents    optional int      — suggested loan size
 *   purpose            optional string   — free-form (e.g. "Veneers")
 *   expiresAt          iso datetime
 *   status             active|expired|in_progress|redeemed
 *   applicationId      string|null       — set when consumer submits
 *   createdAt          iso datetime
 *   lastSeenAt         iso|null          — bumped by markStarted /
 *                                          markStepCompleted
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ConsumerInviteBrand = 'medpay' | 'tradepay' | 'coachpay';

export type ConsumerInviteStatus =
  | 'active'
  | 'expired'
  | 'in_progress'
  | 'redeemed';

export interface ConsumerInviteRecord {
  token: string;
  partnerId: string;
  brand: ConsumerInviteBrand;
  salespersonEmail: string;
  consumerFirstName?: string;
  consumerLastName?: string;
  consumerEmail?: string;
  consumerPhone?: string;
  loanAmountCents?: number;
  purpose?: string;
  expiresAt: string;
  status: ConsumerInviteStatus;
  applicationId: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface ConsumerInviteWithUrl extends ConsumerInviteRecord {
  inviteUrl: string;
}

/* Same accent map the operator store exposes — handy for the UI so a
 * partner can preview their brand chrome before sending. */
export const CONSUMER_BRAND_ACCENT: Record<ConsumerInviteBrand, string> = {
  medpay: '#0E7C66',
  tradepay: '#F97316',
  coachpay: '#6366F1',
};

export const CONSUMER_BRAND_LABEL: Record<ConsumerInviteBrand, string> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
};

const STORE_FILE = path.join(process.cwd(), '.next', 'consumer-invites.json');

const invites = new Map<string, ConsumerInviteRecord>();
let loaded = false;

async function loadIfNeeded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as ConsumerInviteRecord[];
    for (const r of parsed) invites.set(r.token, r);
  } catch {
    /* No persisted file yet — start fresh. */
  }
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
    await fs.writeFile(
      STORE_FILE,
      JSON.stringify(Array.from(invites.values()), null, 2),
      'utf-8',
    );
  } catch {
    /* Best-effort — in-memory map remains authoritative for this run. */
  }
}

function deriveStatus(
  rec: ConsumerInviteRecord,
  now = Date.now(),
): ConsumerInviteStatus {
  /* Redeemed wins (terminal). */
  if (rec.status === 'redeemed') return 'redeemed';
  /* Expiry beats anything else except redeemed. */
  if (Date.parse(rec.expiresAt) <= now && rec.status !== 'in_progress') {
    return 'expired';
  }
  return rec.status;
}

function buildUrl(rec: ConsumerInviteRecord): string {
  /* Relative path — works in dev + prod. The brand slug here is the
   * canonical InviteBrand short code which matches the `/apply/<brand>`
   * dynamic segment used by the consumer apply page. */
  return `/apply/${rec.brand}?invite=${rec.token}`;
}

function withUrl(rec: ConsumerInviteRecord): ConsumerInviteWithUrl {
  const status = deriveStatus(rec);
  return { ...rec, status, inviteUrl: buildUrl(rec) };
}

export interface CreateConsumerInviteInput {
  partnerId: string;
  brand: ConsumerInviteBrand;
  salespersonEmail: string;
  consumer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  loanAmountCents?: number;
  purpose?: string;
  expiryHours: 1 | 24 | 168 | 720;
}

/** Mint a new consumer invite for the given partner+brand. */
export async function createConsumerInvite(
  input: CreateConsumerInviteInput,
): Promise<ConsumerInviteWithUrl> {
  await loadIfNeeded();
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiryHours * 3_600_000);
  const rec: ConsumerInviteRecord = {
    token,
    partnerId: input.partnerId,
    brand: input.brand,
    salespersonEmail: input.salespersonEmail.toLowerCase(),
    consumerFirstName: input.consumer?.firstName?.trim() || undefined,
    consumerLastName: input.consumer?.lastName?.trim() || undefined,
    consumerEmail: input.consumer?.email?.trim() || undefined,
    consumerPhone: input.consumer?.phone?.trim() || undefined,
    loanAmountCents: input.loanAmountCents ?? undefined,
    purpose: input.purpose?.trim() || undefined,
    expiresAt: expiresAt.toISOString(),
    status: 'active',
    applicationId: null,
    createdAt: now.toISOString(),
    lastSeenAt: null,
  };
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}

/** Single lookup — returns null when missing. */
export async function getConsumerInvite(
  token: string,
): Promise<ConsumerInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  return rec ? withUrl(rec) : null;
}

/**
 * List invites for a partner (optionally filtered to a single
 * salesperson). Newest first.
 */
export async function listConsumerInvites(opts: {
  partnerId?: string;
  brand?: ConsumerInviteBrand;
  salespersonEmail?: string;
}): Promise<ConsumerInviteWithUrl[]> {
  await loadIfNeeded();
  let rows = Array.from(invites.values());
  if (opts.partnerId) rows = rows.filter((r) => r.partnerId === opts.partnerId);
  if (opts.brand) rows = rows.filter((r) => r.brand === opts.brand);
  if (opts.salespersonEmail) {
    const target = opts.salespersonEmail.toLowerCase();
    rows = rows.filter((r) => r.salespersonEmail === target);
  }
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return rows.map(withUrl);
}

/** Mark the invite redeemed (terminal). Idempotent — repeat calls noop. */
export async function redeemConsumerInvite(
  token: string,
): Promise<ConsumerInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  if (!rec) return null;
  if (rec.status === 'redeemed') return withUrl(rec);
  rec.status = 'redeemed';
  rec.lastSeenAt = new Date().toISOString();
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}

/**
 * Bump the invite to "in_progress" — called when the consumer opens
 * the apply page or starts filling out the form. Idempotent.
 */
export async function markStarted(
  token: string,
): Promise<ConsumerInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  if (!rec) return null;
  if (rec.status === 'active') rec.status = 'in_progress';
  rec.lastSeenAt = new Date().toISOString();
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}

/**
 * Bump lastSeenAt as the consumer completes a step. Doesn't move the
 * status by itself — terminal moves go through redeem.
 */
export async function markStepCompleted(
  token: string,
): Promise<ConsumerInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  if (!rec) return null;
  rec.lastSeenAt = new Date().toISOString();
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}

/** Attach the resulting application id once the consumer submits. */
export async function attachApplicationId(
  token: string,
  applicationId: string,
): Promise<ConsumerInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  if (!rec) return null;
  rec.applicationId = applicationId;
  rec.lastSeenAt = new Date().toISOString();
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}

/** Reverse lookup — used by the per-application status route to find
 * the invite that minted a given applicationId (so the response can
 * tell the partner who their consumer is, masked to first+last initial). */
export async function findInviteByApplicationId(
  applicationId: string,
): Promise<ConsumerInviteWithUrl | null> {
  await loadIfNeeded();
  for (const rec of invites.values()) {
    if (rec.applicationId === applicationId) return withUrl(rec);
  }
  return null;
}
