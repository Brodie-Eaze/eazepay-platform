/**
 * Per-brand team-invite store.
 *
 * When an Owner/Admin invites a teammate from /v/<brand>/team, this
 * store mints a one-time accept token + persists the invite to a
 * Next.js-local JSON file. The team-invite email carries the accept
 * URL; clicking it lands the recipient on a setup wizard that asks
 * them to confirm + set a password.
 *
 * Same MVP pattern as `invites-store.ts` (partner business onboarding)
 * and `consumer-invites-store.ts` (consumer financing invites) — keeps
 * the platform consistent and lets us swap to Prisma in one round
 * when apps/api lands on Railway.
 *
 * SEC-105 carry-forward: per-process cap of 10,000 entries with FIFO
 * eviction on insert.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { safeLog } from './safe-log';

export type TeamInviteRole = 'Owner' | 'Admin' | 'Operator' | 'Viewer' | 'Compliance';

export type TeamInviteBrand = 'medpay' | 'tradepay' | 'coachpay';

export type TeamInviteStatus = 'active' | 'expired' | 'accepted' | 'revoked';

export interface TeamInviteRecord {
  token: string;
  brand: TeamInviteBrand;
  /** Master-data partnerId (p_helio, p_orion, p_atlas, etc.) that
   *  owns this invite. Used by the per-brand portal's team list to
   *  show only invites for the signed-in partner. */
  partnerId: string;
  /** Email of the inviter (Owner/Admin). Captured for audit. */
  inviterEmail: string;
  /** Display name of the inviter for the email body. */
  inviterName: string;
  /** Email the invite was sent to. */
  recipientEmail: string;
  role: TeamInviteRole;
  inviterNote?: string;
  /** ISO 8601 timestamp when the invite expires. 7 days from creation. */
  expiresAt: string;
  status: TeamInviteStatus;
  /** ISO timestamp when the recipient accepted (status === 'accepted'). */
  acceptedAt: string | null;
  createdAt: string;
}

export interface TeamInviteWithUrl extends TeamInviteRecord {
  acceptUrl: string;
}

const STORE_FILE = path.join(process.cwd(), '.next', 'team-invites.json');

const MAX_TEAM_INVITES = 10_000;

const invites = new Map<string, TeamInviteRecord>();
let loaded = false;

function pruneTeamInvitesGlobal(): void {
  while (invites.size >= MAX_TEAM_INVITES) {
    const oldest = invites.keys().next().value;
    if (!oldest) return;
    invites.delete(oldest);
  }
}

async function loadIfNeeded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as TeamInviteRecord[];
    for (const r of parsed) invites.set(r.token, r);
  } catch {
    /* No persisted file yet — start fresh. */
  }
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(Array.from(invites.values()), null, 2), 'utf-8');
  } catch (err) {
    // SILENT-FAIL FIX: previously swallowed. A failed persist leaves
    // the in-memory map authoritative for THIS process only — on
    // restart every invite minted since the last successful write is
    // lost. Operator needs a signal; throwing would mask the success
    // of the mutation behind a 500, so we log loudly + continue (same
    // contract as audit-log writes).
    safeLog.error({
      event: 'team_invites_store.persist_failed',
      storeFile: STORE_FILE,
      inviteCount: invites.size,
      err,
    });
  }
}

function deriveStatus(rec: TeamInviteRecord, now = Date.now()): TeamInviteStatus {
  if (rec.status === 'accepted' || rec.status === 'revoked') return rec.status;
  if (Date.parse(rec.expiresAt) <= now) return 'expired';
  return rec.status;
}

function buildUrl(rec: TeamInviteRecord): string {
  // Public top-level accept route — recipient may have no cookie when
  // they click the email, so /v/<brand>/* (gated) is the wrong place.
  // Brand is in the path so the page can render brand-aware chrome
  // without the recipient picking from a dropdown.
  return `/accept/${rec.brand}?token=${rec.token}`;
}

function withUrl(rec: TeamInviteRecord): TeamInviteWithUrl {
  return { ...rec, status: deriveStatus(rec), acceptUrl: buildUrl(rec) };
}

export interface CreateTeamInviteInput {
  brand: TeamInviteBrand;
  partnerId: string;
  inviterEmail: string;
  inviterName: string;
  recipientEmail: string;
  role: TeamInviteRole;
  inviterNote?: string;
  /** Optional override — defaults to 7 days. Capped at 30. */
  expiryDays?: number;
}

export async function createTeamInvite(input: CreateTeamInviteInput): Promise<TeamInviteWithUrl> {
  await loadIfNeeded();
  const token = randomUUID();
  const days = Math.min(input.expiryDays ?? 7, 30);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 3_600_000);
  const rec: TeamInviteRecord = {
    token,
    brand: input.brand,
    partnerId: input.partnerId,
    inviterEmail: input.inviterEmail.toLowerCase(),
    inviterName: input.inviterName.trim(),
    recipientEmail: input.recipientEmail.toLowerCase(),
    role: input.role,
    inviterNote: input.inviterNote?.trim() || undefined,
    expiresAt: expiresAt.toISOString(),
    status: 'active',
    acceptedAt: null,
    createdAt: now.toISOString(),
  };
  pruneTeamInvitesGlobal();
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}

export async function getTeamInvite(token: string): Promise<TeamInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  return rec ? withUrl(rec) : null;
}

export async function listTeamInvites(opts: {
  brand?: TeamInviteBrand;
  partnerId?: string;
}): Promise<TeamInviteWithUrl[]> {
  await loadIfNeeded();
  let rows = Array.from(invites.values());
  if (opts.brand) rows = rows.filter((r) => r.brand === opts.brand);
  if (opts.partnerId) rows = rows.filter((r) => r.partnerId === opts.partnerId);
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return rows.map(withUrl);
}

export async function acceptTeamInvite(token: string): Promise<TeamInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  if (!rec) return null;
  if (rec.status === 'accepted') return withUrl(rec);
  if (deriveStatus(rec) === 'expired') return withUrl(rec);
  rec.status = 'accepted';
  rec.acceptedAt = new Date().toISOString();
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}

export async function revokeTeamInvite(token: string): Promise<TeamInviteWithUrl | null> {
  await loadIfNeeded();
  const rec = invites.get(token);
  if (!rec) return null;
  rec.status = 'revoked';
  invites.set(token, rec);
  await persist();
  return withUrl(rec);
}
