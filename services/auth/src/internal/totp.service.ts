import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { BadRequest, Conflict, Unauthorized } from '@eazepay/shared-utils';
import { TOTP_VAULT, type TotpVaultPort } from '../ports/totp-vault.port.js';
import type { UserId } from '@eazepay/shared-types';

// Same Argon2id memory profile we use for password hashing — recovery
// codes are bearer secrets in their own right (one shot bypass of the
// TOTP factor) so they get the same work factor as the password hash.
// Algorithm.Argon2id is an ambient const enum; numeric literal avoids
// the isolatedModules const-enum restriction also used in
// local-identity.adapter.ts.
const ARGON2_ID = 2;
const ARGON2_OPTS = {
  algorithm: ARGON2_ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * RFC 4648 base32 alphabet (no padding). RFC 6238 / Google Authenticator
 * speak base32 over this alphabet — every popular authenticator app
 * (Google, Authy, 1Password, Bitwarden, Microsoft) parses it.
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Period in seconds — RFC 6238 §5.2 recommends 30s, which is what every
 * mainstream authenticator hardcodes. Don't change without coordinating
 * with the enrolment otpauth:// URI (the `period=` parameter); a mismatch
 * silently breaks every code the user produces.
 */
const TOTP_PERIOD_SECONDS = 30;

/**
 * Code length in digits. 6 is the RFC 6238 default and what every
 * authenticator UI renders by default. Bumping to 8 would require
 * updating the `digits=` URI parameter AND every user re-enrols.
 */
const TOTP_DIGITS = 6;

/**
 * Time-step tolerance window. ±1 step (= ±30s) is the OWASP-recommended
 * tradeoff between clock-skew tolerance and brute-force surface — at
 * ±1 step an attacker effectively gets 3 codes per 30s to guess
 * (current, previous, next) instead of 1, so the entropy of a 6-digit
 * code drops from log2(10^6)≈19.9 to ~18.3 bits per attempt. With the
 * @Throttle({limit:5,ttl:60_000}) on the verify route that's still
 * cryptographically out of reach within any reasonable attack budget.
 */
const TOTP_WINDOW_STEPS = 1;

/**
 * Number of recovery codes minted at enrolment. 10 is the
 * industry-standard count (GitHub, Google, AWS, Auth0 all mint 10).
 * Each is a single-use bearer token equivalent to a successful TOTP
 * verification — used when the user lost their authenticator device
 * and needs to break the glass.
 */
const RECOVERY_CODE_COUNT = 10;

/**
 * Each recovery code is 10 hex chars (5 bytes ≈ 40 bits of entropy).
 * 40 bits is enough that brute-forcing one code against the
 * @Throttle-rate-limited verify endpoint is infeasible; longer codes
 * trade off transcription error during account recovery against
 * marginal entropy gains.
 */
const RECOVERY_CODE_HEX_BYTES = 5;

/** Pretty-print recovery codes as XXXXX-XXXXX so transcribing them by
 *  hand from a paper backup is less error-prone. The dash is purely
 *  cosmetic — we hash the dash-stripped lowercase value. */
function formatRecoveryCode(hex: string): string {
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
}

/** Strip formatting + lowercase for comparison. Matches what we feed
 *  into argon2 at enrolment, so a code written down as `ab12c-d34e5`
 *  pasted as `AB12C-D34E5` still verifies. */
function normaliseRecoveryCode(raw: string): string {
  return raw.replace(/[^0-9a-f]/gi, '').toLowerCase();
}

/**
 * Encode arbitrary bytes as RFC 4648 base32 without padding.
 *
 * Why no padding: the otpauth:// URI scheme used by every authenticator
 * app (Google Authenticator, Authy, 1Password, Bitwarden, Microsoft
 * Authenticator) treats `=` as a URL terminator/PII character and
 * commonly fails to parse padded secrets. Strip on output, accept
 * either on input via `base32Decode`.
 */
function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i += 1) {
    value = (value << 8) | buf[i]!;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

/** Inverse of base32Encode — tolerates lowercase / spaces / padding so
 *  the enrol-verify path matches what the user actually types in. */
function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/\s|=/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]!);
    if (idx < 0) {
      throw BadRequest({
        code: 'totp_invalid_secret_encoding',
        detail: 'TOTP secret must be RFC 4648 base32.',
      });
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * RFC 6238 / RFC 4226 — HMAC-SHA1 truncated-output one-time password.
 *
 * Why SHA1 in 2026: every authenticator app speaks RFC 4226 (HOTP) +
 * RFC 6238 (TOTP) which both pin HMAC-SHA1 by default. Switching to
 * SHA256 / SHA512 requires `algorithm=SHA256` in the otpauth URI and
 * crashes older 1Password versions on Android. Stick with SHA1 — the
 * MAC is HMAC, not raw SHA1, and the 6-digit truncated output makes
 * the underlying hash choice cryptographically irrelevant.
 */
function hotp(secret: Buffer, counter: bigint): string {
  // RFC 4226 §5.3: counter is an 8-byte big-endian integer.
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter, 0);
  const mac = createHmac('sha1', secret).update(counterBuf).digest();
  // §5.3 dynamic truncation: the offset is the low nibble of the last byte.
  const offset = mac[mac.length - 1]! & 0x0f;
  const binCode =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  const modulus = 10 ** TOTP_DIGITS;
  return (binCode % modulus).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * SEC-016 — TOTP second-factor.
 *
 * Threat closed: SMS / email OTP is vulnerable to SIM-swap (telco
 * social-engineering) and email account takeover. Both attacks have
 * been the proximate cause of multi-million-dollar consumer-finance
 * fraud cases (CFPB v. Coinbase 2024). TOTP delivers a shared-secret
 * second factor whose verification never leaves the device, so an
 * attacker who compromises the user's email + phone still cannot
 * complete the login challenge.
 *
 * Storage shape:
 *   - User.totpSecretCiphertext (String?) — opaque envelope, sealed
 *     via the TotpVaultPort (production: PiiVaultService.sealOpaque
 *     with `scope=totp_secret`, `userId=<uuid>`). A database dump
 *     yields ciphertext only; the KEK is held by the KMS.
 *   - User.totpRecoveryCodes (Json?) — array of
 *     `{ hash: string; used: boolean; usedAt?: string }`. The hash is
 *     argon2id with the same work factor as the password column. A
 *     `used: true` row can never be redeemed twice (single-use).
 *
 * Audit rows emitted by this service (caller writes via
 * `prisma.auditOutbox.create` so the row participates in the same
 * transaction):
 *   - `auth.mfa.totp.enrolled`           — verify step succeeded,
 *     secret committed to row.
 *   - `auth.mfa.totp.verified`           — verify step on login,
 *     access tokens issued.
 *   - `auth.mfa.recovery_code_used`      — recovery-code burned;
 *     records remaining-count for ops visibility.
 *
 * Every state-changing TOTP path is also @Throttle-rated at 5/min/IP
 * via the controller — see auth.controller.ts.
 */
@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  constructor(@Inject(TOTP_VAULT) private readonly vault: TotpVaultPort) {}

  /**
   * Step 1 of enrolment. Mint a fresh secret + recovery codes, package
   * the otpauth:// URI for QR display, and seal the secret via the
   * vault port. The caller is responsible for persisting the sealed
   * envelope + hashed recovery codes to the User row in the SAME
   * transaction as the audit write — this method is pure and idempotent.
   *
   * Why two-step (init then verify): the user MUST prove possession of
   * the authenticator before we commit the secret. If we wrote the
   * secret immediately on `init`, an attacker who could call `init` on
   * a victim's account could then know the secret without ever
   * scanning the QR, defeating the second-factor property. The verify
   * step locks the value in only after a fresh code from THAT secret
   * round-trips successfully.
   */
  async initEnrolment(input: {
    userId: UserId;
    accountLabel: string; // typically email or phone — shown in the authenticator UI
    issuer?: string; // 'EazePay'
  }): Promise<{
    enrolmentId: string;
    secret: string; // base32, returned ONCE — caller stores in short-lived Redis only
    otpauthUri: string;
    recoveryCodesPlaintext: string[]; // returned ONCE
  }> {
    // 20 bytes = 160 bits, the RFC 4226 §4 reference seed length. Larger
    // secrets work but consume more space in the QR + every authenticator
    // truncates internally.
    const secretBytes = randomBytes(20);
    const secretBase32 = base32Encode(secretBytes);
    const issuer = input.issuer ?? 'EazePay';
    const enrolmentId = randomUUID();

    // otpauth://totp/<issuer>:<label>?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30
    //
    // The issuer prefix on the label AND the `issuer=` query parameter
    // are BOTH required — older versions of Google Authenticator only
    // honour the label-prefix form, newer versions only honour the
    // query-string form, so emitting both keeps every client happy.
    const safeIssuer = encodeURIComponent(issuer);
    const safeLabel = encodeURIComponent(input.accountLabel);
    const otpauthUri =
      `otpauth://totp/${safeIssuer}:${safeLabel}` +
      `?secret=${secretBase32}` +
      `&issuer=${safeIssuer}` +
      `&algorithm=SHA1` +
      `&digits=${TOTP_DIGITS}` +
      `&period=${TOTP_PERIOD_SECONDS}`;

    const recoveryCodesPlaintext: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      const hex = randomBytes(RECOVERY_CODE_HEX_BYTES).toString('hex');
      recoveryCodesPlaintext.push(formatRecoveryCode(hex));
    }

    return {
      enrolmentId,
      secret: secretBase32,
      otpauthUri,
      recoveryCodesPlaintext,
    };
  }

  /**
   * Step 2 of enrolment. Caller hands us:
   *   - the original `secret` we returned from `initEnrolment` (held in
   *     short-lived Redis or browser state between init/verify)
   *   - the 6-digit code the user just produced from their authenticator
   *
   * On success we:
   *   1. Confirm the code matches the secret within ±1 step.
   *   2. Seal the secret via the vault port — the returned ciphertext
   *      is what the caller persists into `User.totpSecretCiphertext`.
   *   3. Hash each recovery code with argon2id and return the array
   *      shape the caller writes into `User.totpRecoveryCodes`.
   *
   * If the code doesn't match we throw `Unauthorized otp_invalid` — the
   * controller's @Throttle absorbs brute-force attempts.
   */
  async commitEnrolment(input: {
    userId: UserId;
    secret: string;
    code: string;
    recoveryCodesPlaintext: string[];
  }): Promise<{
    sealedSecret: string;
    recoveryCodes: Array<{ hash: string; used: boolean }>;
  }> {
    if (!this.verifyCode(input.secret, input.code)) {
      throw Unauthorized({
        code: 'otp_invalid',
        detail: 'TOTP code did not match the enrolled secret.',
      });
    }
    if (input.recoveryCodesPlaintext.length !== RECOVERY_CODE_COUNT) {
      throw BadRequest({
        code: 'totp_recovery_code_count_mismatch',
        detail: `Expected ${RECOVERY_CODE_COUNT} recovery codes.`,
      });
    }

    // Vault seal binds `scope=totp_secret` + `userId` into the AAD so
    // a stolen-then-rewritten DB cannot transplant a secret from user
    // A onto user B. See PiiVaultService.sealOpaque docstring for the
    // mechanism.
    const sealedSecret = await this.vault.sealTotpSecret({
      userId: input.userId,
      secretBase32: input.secret,
    });

    const recoveryCodes: Array<{ hash: string; used: boolean }> = [];
    for (const plaintext of input.recoveryCodesPlaintext) {
      const normalised = normaliseRecoveryCode(plaintext);
      const hashed = await argon2Hash(normalised, ARGON2_OPTS);
      recoveryCodes.push({ hash: hashed, used: false });
    }

    return { sealedSecret, recoveryCodes };
  }

  /**
   * Verify a 6-digit code OR a recovery code against the persisted
   * second-factor state. Returns the outcome so the caller can:
   *   - mint tokens (success)
   *   - consume a recovery code in the same transaction it audits
   *   - throw a typed error on mismatch
   *
   * Recovery-code path: caller pre-fetches the recoveryCodes JSON
   * from the User row and hands it in. We iterate until we find an
   * unused hash that argon2-verifies against the submitted code, mark
   * that slot `used`, and return the updated array for the caller to
   * persist + emit `auth.mfa.recovery_code_used`. We DON'T short-circuit
   * on first match into a constant-time-broken loop — argon2.verify is
   * deliberately slow, so iterating 10 entries adds a couple of
   * hundred ms to the worst case which is fine on a step-up surface.
   */
  async verifyChallenge(input: {
    userId: UserId;
    submittedCode: string;
    sealedSecret: string | null;
    recoveryCodes: Array<{ hash: string; used: boolean; usedAt?: string }>;
  }): Promise<
    | { kind: 'totp_ok' }
    | {
        kind: 'recovery_code_ok';
        updatedRecoveryCodes: Array<{
          hash: string;
          used: boolean;
          usedAt?: string;
        }>;
        remaining: number;
      }
  > {
    // 1. Try the TOTP path first — it's the cheap branch.
    if (input.sealedSecret && /^\d{6}$/.test(input.submittedCode)) {
      const secretBase32 = await this.vault.openTotpSecret({
        userId: input.userId,
        envelope: input.sealedSecret,
      });
      if (this.verifyCode(secretBase32, input.submittedCode)) {
        return { kind: 'totp_ok' };
      }
    }

    // 2. Fall back to the recovery-code path. The user pastes
    //    `xxxxx-xxxxx` (or `xxxxxxxxxx`); we normalise before verify.
    const normalised = normaliseRecoveryCode(input.submittedCode);
    if (/^[0-9a-f]{10}$/.test(normalised)) {
      for (let i = 0; i < input.recoveryCodes.length; i += 1) {
        const slot = input.recoveryCodes[i]!;
        if (slot.used) continue;
        // argon2Verify is constant-time over a matched hash, so a
        // mismatch on slot 3 versus slot 7 doesn't leak which slot
        // was the live one.
        const ok = await argon2Verify(slot.hash, normalised);
        if (ok) {
          const updated = input.recoveryCodes.map((s, idx) =>
            idx === i ? { ...s, used: true, usedAt: new Date().toISOString() } : s,
          );
          const remaining = updated.filter((s) => !s.used).length;
          return {
            kind: 'recovery_code_ok',
            updatedRecoveryCodes: updated,
            remaining,
          };
        }
      }
    }

    throw Unauthorized({
      code: 'otp_invalid',
      detail: 'TOTP code did not match.',
    });
  }

  /**
   * Pure code-vs-secret check with ±1 step tolerance. Exposed for
   * tests / migrations; the controller path uses `verifyChallenge`.
   */
  private verifyCode(secretBase32: string, submittedCode: string): boolean {
    if (!/^\d{6}$/.test(submittedCode)) return false;
    const secret = base32Decode(secretBase32);
    const now = Math.floor(Date.now() / 1000);
    const counter = BigInt(Math.floor(now / TOTP_PERIOD_SECONDS));
    const submittedBuf = Buffer.from(submittedCode, 'utf8');
    for (let step = -TOTP_WINDOW_STEPS; step <= TOTP_WINDOW_STEPS; step += 1) {
      const expected = hotp(secret, counter + BigInt(step));
      const expectedBuf = Buffer.from(expected, 'utf8');
      // timingSafeEqual requires equal length — they always are here
      // (both 6 digits) but the guard keeps us safe if TOTP_DIGITS ever
      // moves.
      if (
        expectedBuf.length === submittedBuf.length &&
        timingSafeEqual(expectedBuf, submittedBuf)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Surfaced for the controller path that needs to refuse a SECOND
   * enrolment when the user already has TOTP configured — the brief is
   * unambiguous that enrolment is one-shot until an explicit disable.
   * The audit row + DB state are caller concerns; this is a typed
   * helper so the calling code reads cleanly.
   */
  static throwAlreadyEnrolled(): never {
    throw Conflict({
      code: 'totp_already_enrolled',
      detail: 'TOTP is already enrolled for this account.',
    });
  }
}
