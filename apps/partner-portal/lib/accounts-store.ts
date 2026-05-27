/**
 * Partner-portal-side user account store.
 *
 * Why this exists in the partner-portal (not apps/api):
 *   apps/api is not deployed yet — Railway only runs the partner-
 *   portal Next.js service. To let businesses actually sign up and
 *   their teammates accept invites + set passwords today, we keep
 *   a local store of accounts with scrypt-hashed passwords inside
 *   the partner-portal. When apps/api lands on Railway with Postgres,
 *   this store will be replaced with Prisma User + MerchantUser rows
 *   (the schema is already there); the BFF routes that read/write
 *   this store will swap their implementation in one round without
 *   changing the surface contract.
 *
 * Persistence:
 *   In-process Map + .next/accounts.json mirror. Same MVP shape as
 *   invites-store + consumer-invites-store + team-invites-store —
 *   shipping fast now, durable Postgres later.
 *
 * Security posture (until apps/api lands):
 *   - Passwords stored as scrypt hash (Node native, no extra deps).
 *     Cost params chosen for ~50ms hash on a modern laptop — slow
 *     enough to make offline brute-force expensive, fast enough to
 *     not bog down sign-in.
 *   - 12+ chars + complexity enforced at the Zod DTO boundary
 *     (mirrors the apps/api password policy so the rules don't drift).
 *   - Account email is the unique key. Lookups are case-insensitive.
 *   - Status transitions: invited → active (on first password set) →
 *     suspended (manual op). Cannot transition back from suspended
 *     without operator intervention.
 *   - SEC-105 carry-forward: 10k cap with FIFO eviction.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { safeLog } from './safe-log';

export type AccountStatus = 'invited' | 'active' | 'suspended';

export type AccountRole = 'Owner' | 'Admin' | 'Operator' | 'Viewer' | 'Compliance';

export type AccountBrand = 'medpay' | 'tradepay' | 'coachpay';

export interface AccountRecord {
  /** UUID v4 — stable across renames. */
  userId: string;
  /** Lower-cased email. Unique. */
  email: string;
  /** Human-friendly display name. */
  displayName: string;
  /** The brand portal this account belongs to. One per account today;
   *  cross-brand merchants get one account per brand (mirrors how the
   *  per-brand portal scopes everything). */
  brand: AccountBrand;
  /** Master-data partnerId (p_helio, etc.) this account is bound to.
   *  Determines which Helio / Orion / Atlas demo data they see. */
  partnerId: string;
  role: AccountRole;
  status: AccountStatus;
  /** scrypt hash of the password. Null until first password set
   *  (status='invited'). */
  passwordHash: string | null;
  /** Random salt — 16 bytes hex. */
  passwordSalt: string | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO timestamp of most recent password change. */
  passwordChangedAt: string | null;
  /** ISO timestamp of most recent successful sign-in. */
  lastSignInAt: string | null;
}

const STORE_FILE = path.join(process.cwd(), '.next', 'accounts.json');

const MAX_ACCOUNTS = 10_000;

const accounts = new Map<string, AccountRecord>();
let loaded = false;

function pruneAccountsGlobal(): void {
  while (accounts.size >= MAX_ACCOUNTS) {
    const oldest = accounts.keys().next().value;
    if (!oldest) return;
    accounts.delete(oldest);
  }
}

async function loadIfNeeded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AccountRecord[];
    for (const r of parsed) accounts.set(r.userId, r);
  } catch {
    /* fresh */
  }
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(Array.from(accounts.values()), null, 2), 'utf-8');
  } catch (err) {
    // SILENT-FAIL FIX: this store backs sign-in. A persist failure
    // after createInvitedAccount / setAccountPassword / authenticate
    // means the auth state is correct in-process but lost on restart —
    // password the user just set won't survive a deploy. Log loudly so
    // an operator notices before the next restart eats real accounts.
    // Not thrown: would mask the success of the calling mutation.
    safeLog.error({
      event: 'accounts_store.persist_failed',
      storeFile: STORE_FILE,
      accountCount: accounts.size,
      err,
    });
  }
}

// scrypt cost: N=16384 (2^14), r=8, p=1, keylen=64. Tuned for ~50ms
// on a 2024 laptop; high enough that an offline attacker pays for
// each guess, low enough that sign-in doesn't feel sluggish.
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export function hashPassword(plaintext: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plaintext.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');
  return { hash, salt };
}

export function verifyPassword(plaintext: string, hash: string, salt: string): boolean {
  // timingSafeEqual demands equal-length buffers; the hex hash is
  // always SCRYPT_KEYLEN*2 chars so the lengths match. The function
  // returns false on any error instead of throwing — keeps the API
  // signature clean for callers that don't want try/catch.
  try {
    const computed = scryptSync(plaintext.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    const stored = Buffer.from(hash, 'hex');
    if (computed.length !== stored.length) return false;
    return timingSafeEqual(computed, stored);
  } catch {
    return false;
  }
}

/**
 * Create an account in `invited` status (no password yet). Used by:
 *   - onboarding submit (Owner of a newly-onboarded business)
 *   - team-invite accept (a teammate the Owner invites)
 *
 * Returns the new userId. If an account already exists for this
 * email + brand combo, returns the existing userId WITHOUT changing
 * its state — onboarding is idempotent at the email layer so a
 * retry doesn't clobber a real account.
 */
export async function createInvitedAccount(input: {
  email: string;
  displayName: string;
  brand: AccountBrand;
  partnerId: string;
  role: AccountRole;
}): Promise<{ userId: string; created: boolean }> {
  await loadIfNeeded();
  const email = input.email.toLowerCase().trim();
  const existing = Array.from(accounts.values()).find(
    (a) => a.email === email && a.brand === input.brand,
  );
  if (existing) {
    return { userId: existing.userId, created: false };
  }
  pruneAccountsGlobal();
  const userId = randomUUID();
  const rec: AccountRecord = {
    userId,
    email,
    displayName: input.displayName.trim(),
    brand: input.brand,
    partnerId: input.partnerId,
    role: input.role,
    status: 'invited',
    passwordHash: null,
    passwordSalt: null,
    createdAt: new Date().toISOString(),
    passwordChangedAt: null,
    lastSignInAt: null,
  };
  accounts.set(userId, rec);
  await persist();
  return { userId, created: true };
}

/** Set the password for an invited account, transitioning it to active. */
export async function setAccountPassword(input: {
  userId: string;
  newPassword: string;
}): Promise<AccountRecord | null> {
  await loadIfNeeded();
  const rec = accounts.get(input.userId);
  if (!rec) return null;
  if (rec.status === 'suspended') return null;
  const { hash, salt } = hashPassword(input.newPassword);
  rec.passwordHash = hash;
  rec.passwordSalt = salt;
  rec.passwordChangedAt = new Date().toISOString();
  rec.status = 'active';
  accounts.set(input.userId, rec);
  await persist();
  return rec;
}

/** Find by email (case-insensitive). Brand-scoped for the partner-portal. */
export async function findAccountByEmail(
  email: string,
  brand: AccountBrand,
): Promise<AccountRecord | null> {
  await loadIfNeeded();
  const target = email.toLowerCase().trim();
  return Array.from(accounts.values()).find((a) => a.email === target && a.brand === brand) ?? null;
}

export async function getAccount(userId: string): Promise<AccountRecord | null> {
  await loadIfNeeded();
  return accounts.get(userId) ?? null;
}

/**
 * Verify email+password and stamp lastSignInAt on success. Returns
 * the account record or null. ALWAYS runs scrypt — even on a miss —
 * so the response time is constant per brand (prevents user-
 * enumeration via timing).
 */
export async function authenticate(input: {
  email: string;
  password: string;
  brand: AccountBrand;
}): Promise<AccountRecord | null> {
  const account = await findAccountByEmail(input.email, input.brand);

  // Dummy salt + hash for the no-account case. The same scrypt work
  // factor runs regardless of match so response time is invariant.
  const DUMMY_SALT = 'a'.repeat(32);
  const DUMMY_HASH = 'b'.repeat(SCRYPT_KEYLEN * 2);

  const salt = account?.passwordSalt ?? DUMMY_SALT;
  const hash = account?.passwordHash ?? DUMMY_HASH;
  const ok = verifyPassword(input.password, hash, salt);

  if (!ok || !account || account.status !== 'active') return null;

  account.lastSignInAt = new Date().toISOString();
  accounts.set(account.userId, account);
  await persist();
  return account;
}

/** Test util — clear in-memory + disk state between specs. */
export async function _resetAccountsForTest(): Promise<void> {
  accounts.clear();
  loaded = false;
  try {
    await fs.unlink(STORE_FILE);
  } catch {
    /* missing is fine */
  }
}
