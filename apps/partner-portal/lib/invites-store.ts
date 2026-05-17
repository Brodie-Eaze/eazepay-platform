/**
 * In-memory + JSON-file backed invite store.
 *
 * Source of truth for direct-invite tokens minted by the master
 * operator (Brodie) from `/onboarding-pipeline`. Same MVP demo pattern
 * the other BFF routes use: state lives in module scope, and we
 * optionally persist to `.next/invites.json` so the seed survives a
 * dev-server restart.
 *
 * Schema highlights:
 *   - One invite per token (`crypto.randomUUID()`)
 *   - Brand is locked at mint time (medpay / tradepay / coachpay)
 *   - Prefill bag carries optional businessName / contactEmail / contactPhone
 *   - Status is derived: 'redeemed' wins, then 'expired', else 'active'
 *   - Every read is tagged with the operator's `invitedById` so the
 *     pipeline can filter "Your invites"
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type InviteBrand = 'medpay' | 'tradepay' | 'coachpay';

export interface InvitePrefill {
  businessName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export type RawStatus = 'active' | 'expired' | 'redeemed';

export interface InviteRecord {
  token: string;
  brand: InviteBrand;
  prefill: InvitePrefill;
  invitedByEmail: string;
  invitedById: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedApplicationId: string | null;
}

export interface InviteWithStatus extends InviteRecord {
  status: RawStatus;
  inviteUrl: string;
}

/* Brand slug map — the canonical short code we store maps to the
 * onboarding route directory the business lands on. */
export const BRAND_ROUTE: Record<InviteBrand, string> = {
  medpay: 'eaze-med-pay',
  tradepay: 'trade-pay',
  coachpay: 'coach-pay',
};

/* Brand label + accent (mirrors libs/shared-types BRANDS.accentHex) so
 * the modal + landing banner can render brand chrome without pulling
 * the full BRANDS map. */
export const BRAND_LABEL: Record<InviteBrand, string> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
};

export const BRAND_ACCENT: Record<InviteBrand, string> = {
  medpay: '#0E7C66',
  tradepay: '#F97316',
  coachpay: '#6366F1',
};

/* Reverse map: wizard config.slug ('trade-pay'/'med-pay'/'coach-pay')
 * → InviteBrand. Used by the apply endpoint to validate that the
 * inviteToken brand matches the brand actually being applied to. */
export const BRAND_FROM_CONFIG_SLUG: Record<string, InviteBrand> = {
  'trade-pay': 'tradepay',
  'med-pay': 'medpay',
  'coach-pay': 'coachpay',
};

const STORE_FILE = path.join(process.cwd(), '.next', 'invites.json');

/** SEC-105: cap the in-process map so an attacker can't disk-fill or
 *  OOM the BFF by calling /api/onboarding/invite in a tight loop. The
 *  oldest invite is evicted FIFO on insert when the map is full.
 *  10k entries × ~500 bytes ≈ 5 MB ceiling — fine for in-process; the
 *  Prisma swap removes the cap entirely. */
const MAX_INVITES = 10_000;

const invites = new Map<string, InviteRecord>();
let loaded = false;

function pruneInvitesGlobal(): void {
  while (invites.size >= MAX_INVITES) {
    const oldest = invites.keys().next().value;
    if (!oldest) return;
    invites.delete(oldest);
  }
}

async function loadIfNeeded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as InviteRecord[];
    for (const r of parsed) invites.set(r.token, r);
  } catch {
    /* No persisted file yet — start fresh. */
  }
}

async function persist() {
  try {
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(Array.from(invites.values()), null, 2), 'utf-8');
  } catch {
    /* Best-effort — in-memory map is still authoritative for this run. */
  }
}

function deriveStatus(rec: InviteRecord, now = Date.now()): RawStatus {
  if (rec.redeemedAt) return 'redeemed';
  if (Date.parse(rec.expiresAt) <= now) return 'expired';
  return 'active';
}

function buildUrl(token: string, brand: InviteBrand): string {
  /* Relative path works in dev; production deploy can prefix
   * `https://partners.eazepay.com` via an env-derived base if needed.
   * We keep it relative to match the spec note that "relative path
   * works in dev". */
  return `/onboarding/${BRAND_ROUTE[brand]}?invite=${token}`;
}

function withStatus(rec: InviteRecord): InviteWithStatus {
  return {
    ...rec,
    status: deriveStatus(rec),
    inviteUrl: buildUrl(rec.token, rec.brand),
  };
}

/** Stable, human-ish id derived from email so the pipeline filter
 * matches across page-reloads even without a real auth session. */
export function invitedIdFromEmail(email: string): string {
  return `op_${email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')}`;
}

export interface CreateInviteInput {
  brand: InviteBrand;
  prefill?: InvitePrefill;
  expiryHours: number;
  invitedByEmail: string;
}

export async function createInvite(input: CreateInviteInput): Promise<InviteWithStatus> {
  await loadIfNeeded();
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiryHours * 3_600_000);
  const rec: InviteRecord = {
    token,
    brand: input.brand,
    prefill: input.prefill ?? {},
    invitedByEmail: input.invitedByEmail,
    invitedById: invitedIdFromEmail(input.invitedByEmail),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    redeemedAt: null,
    redeemedApplicationId: null,
  };
  pruneInvitesGlobal();
  invites.set(token, rec);
  await persist();
  return withStatus(rec);
}

export async function getInvite(token: string): Promise<InviteWithStatus | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  return rec ? withStatus(rec) : null;
}

export async function listInvites(opts?: { invitedById?: string }): Promise<InviteWithStatus[]> {
  await loadIfNeeded();
  let rows = Array.from(invites.values());
  if (opts?.invitedById) {
    rows = rows.filter((r) => r.invitedById === opts.invitedById);
  }
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return rows.map(withStatus);
}

export async function redeemInvite(
  token: string,
  applicationId: string,
): Promise<InviteWithStatus | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  if (!rec) return null;
  if (rec.redeemedAt) return withStatus(rec);
  if (deriveStatus(rec) === 'expired') return withStatus(rec);
  rec.redeemedAt = new Date().toISOString();
  rec.redeemedApplicationId = applicationId;
  invites.set(token, rec);
  await persist();
  return withStatus(rec);
}
