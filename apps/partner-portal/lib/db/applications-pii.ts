/**
 * Application-row PII sealing/opening — the data-access boundary for the
 * four encrypted consumer fields on `applications`.
 *
 * PRIV-002. Every writer of `applications` consumer PII goes through
 * `sealApplicationPii`; every reader that needs the cleartext goes
 * through `decryptApplicationRow` (or `decryptApplicationRows`). Routes
 * never touch `consumerFirstEnc` etc. directly — keeping the envelope
 * encoding in one place means a future key rotation or encoding bump is
 * a single-file change.
 *
 * AAD for all four fields is bound to the application `id`, so the id
 * MUST exist before sealing. Because Drizzle's `id` defaults to
 * `defaultRandom()` (DB-side), the write path now mints the id in
 * application code (`randomUUID()`) and passes it explicitly to both the
 * seal call and the `insert().values({ id, ... })` — mirroring the
 * backend `sealForBo` contract where the caller pre-generates the row id.
 */

import { randomUUID } from 'node:crypto';
import { emailBlindIndex, openEdgePiiField, sealEdgePiiField } from './pii-crypto';

/** Logical field names used in the AAD. Changing these is a breaking
 *  change to every stored ciphertext — do not edit without a re-encrypt
 *  migration. */
export const EDGE_PII_FIELDS = {
  first: 'consumer_first',
  last: 'consumer_last',
  email: 'consumer_email',
  phone: 'consumer_phone',
} as const;

export interface ConsumerPiiPlaintext {
  consumerFirst: string;
  consumerLast: string;
  consumerEmail: string;
  consumerPhone: string;
}

/** The encrypted column values written to `applications`. */
export interface SealedApplicationPii {
  consumerFirstEnc: string;
  consumerLastEnc: string;
  consumerEmailEnc: string;
  consumerPhoneEnc: string;
  /** Deterministic HMAC of the normalized email for future equality
   *  lookup. See `emailBlindIndex`. */
  consumerEmailBidx: string;
}

/**
 * Mint a fresh application id. The write path uses this so the same id
 * binds the AAD at seal time AND is the inserted primary key.
 */
export function newApplicationId(): string {
  return randomUUID();
}

/**
 * Encrypt the four consumer PII fields for `applicationId`, plus compute
 * the email blind index. Email is lowercased before both sealing and
 * indexing to match the legacy write-path normalization.
 *
 * Returns the exact column values to spread into `insert().values()`.
 */
export async function sealApplicationPii(
  applicationId: string,
  pii: ConsumerPiiPlaintext,
): Promise<SealedApplicationPii> {
  const email = pii.consumerEmail.trim().toLowerCase();
  const [consumerFirstEnc, consumerLastEnc, consumerEmailEnc, consumerPhoneEnc] = await Promise.all(
    [
      sealEdgePiiField(applicationId, EDGE_PII_FIELDS.first, pii.consumerFirst),
      sealEdgePiiField(applicationId, EDGE_PII_FIELDS.last, pii.consumerLast),
      sealEdgePiiField(applicationId, EDGE_PII_FIELDS.email, email),
      sealEdgePiiField(applicationId, EDGE_PII_FIELDS.phone, pii.consumerPhone),
    ],
  );
  return {
    consumerFirstEnc,
    consumerLastEnc,
    consumerEmailEnc,
    consumerPhoneEnc,
    consumerEmailBidx: emailBlindIndex(email),
  };
}

/**
 * Minimal shape a row must have to be decryptable. Accepts the full
 * Drizzle `applications` select row (which is a superset) so callers can
 * pass `appRow` straight through.
 */
export interface EncryptedApplicationRow {
  id: string;
  consumerFirstEnc: string | null;
  consumerLastEnc: string | null;
  consumerEmailEnc: string | null;
  consumerPhoneEnc: string | null;
}

/**
 * Transparently decrypt one application row's PII back to plaintext.
 * Returns the four fields under their LEGACY names (`consumerFirst`,
 * `consumerLast`, `consumerEmail`, `consumerPhone`) so existing read
 * sites that referenced `a.consumerFirst` keep working after the column
 * is swapped to the `_enc` variant — the call site changes from a bare
 * field access to `(await decryptApplicationRow(a)).consumerFirst`.
 *
 * Fails closed: if a ciphertext is missing the row is malformed (every
 * `_enc` column is NOT NULL post-backfill), so we throw rather than
 * silently surfacing an empty string that could be mistaken for real
 * (absent) PII.
 */
export async function decryptApplicationRow(
  row: EncryptedApplicationRow,
): Promise<ConsumerPiiPlaintext> {
  if (
    row.consumerFirstEnc == null ||
    row.consumerLastEnc == null ||
    row.consumerEmailEnc == null ||
    row.consumerPhoneEnc == null
  ) {
    throw new Error(
      `application ${row.id} has a NULL encrypted PII column — refusing to surface partial PII`,
    );
  }
  const [consumerFirst, consumerLast, consumerEmail, consumerPhone] = await Promise.all([
    openEdgePiiField(row.id, EDGE_PII_FIELDS.first, row.consumerFirstEnc),
    openEdgePiiField(row.id, EDGE_PII_FIELDS.last, row.consumerLastEnc),
    openEdgePiiField(row.id, EDGE_PII_FIELDS.email, row.consumerEmailEnc),
    openEdgePiiField(row.id, EDGE_PII_FIELDS.phone, row.consumerPhoneEnc),
  ]);
  return { consumerFirst, consumerLast, consumerEmail, consumerPhone };
}

/** Batch helper — decrypt many rows, preserving order. Used by the
 *  dashboard list reads. */
export async function decryptApplicationRows(
  rows: EncryptedApplicationRow[],
): Promise<ConsumerPiiPlaintext[]> {
  return Promise.all(rows.map((r) => decryptApplicationRow(r)));
}

/**
 * Decrypt many rows and return each paired with its source row. Preferred
 * over `decryptApplicationRows` at list-render call sites: the returned
 * tuple element is statically non-undefined, so `.map()` over it type-
 * checks under `noUncheckedIndexedAccess` without index juggling.
 */
export async function decryptApplicationRowsZipped<T extends EncryptedApplicationRow>(
  rows: T[],
): Promise<Array<{ row: T; pii: ConsumerPiiPlaintext }>> {
  const decrypted = await Promise.all(rows.map((r) => decryptApplicationRow(r)));
  return rows.map((row, i) => ({ row, pii: decrypted[i]! }));
}
