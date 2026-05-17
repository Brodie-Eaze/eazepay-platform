import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import { sha256Hex, BadRequest, TooManyRequests, Unauthorized } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

interface ChallengeRecord {
  userId: UserId;
  channel: 'sms' | 'email' | 'totp';
  destination: string; // hashed; never plaintext
  codeHash: string;
  attempts: number;
  purpose: 'register_verify' | 'login_mfa' | 'step_up' | 'password_reset';
  expiresAt: number; // ms epoch
}

const MAX_ATTEMPTS = 5;
const DEFAULT_TTL_SECONDS = 600; // 10 minutes
const KEY_PREFIX = 'otp:';

// SEC-012 — per-identifier rate-limit constants.
//
// Threat being closed: pre-fix, MAX_ATTEMPTS=5 only applied within ONE
// challengeId. An attacker could call `/auth/login` (or the resend
// endpoint) repeatedly with the same email/phone, each call returning a
// fresh challengeId carrying its own 5-attempt budget. Over an hour
// that's hundreds of guesses against a six-digit code per identifier,
// pre-empting the lockout we thought was in place.
//
// Fix: two Redis-backed bounds, both keyed on a sha256 of the identifier
// so we never put the raw email/phone in Redis keys (PII):
//   1. Sliding window — at most RATE_LIMIT_MAX_PER_WINDOW challenges
//      created in any rolling RATE_LIMIT_WINDOW_SECONDS. Implemented
//      with INCR + EXPIRE-on-first-hit so we don't need a sorted set.
//   2. Concurrent active cap — at most MAX_CONCURRENT_ACTIVE unexpired
//      challenges per identifier at once. Prevents an attacker from
//      fan-out-creating challenges within the window.
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX_PER_WINDOW = 10;
const MAX_CONCURRENT_ACTIVE = 3;
const RL_KEY_PREFIX = 'otp:rl:';
const ACTIVE_KEY_PREFIX = 'otp:active:';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async createChallenge(input: {
    userId: UserId;
    channel: 'sms' | 'email' | 'totp';
    destination: string;
    purpose: 'register_verify' | 'login_mfa' | 'step_up' | 'password_reset';
    ttlSeconds?: number;
  }): Promise<{ challengeId: string; code: string; expiresAt: string }> {
    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const identifierHash = sha256Hex(input.destination);

    // SEC-012 — gate before issuing a fresh code. Two independent
    // checks, in order:
    //
    //   1. Concurrent-active cap. SCAN for unexpired challenges keyed
    //      to the same identifier; refuse if MAX_CONCURRENT_ACTIVE
    //      are already alive. This stops an attacker from racing
    //      multiple createChallenge calls inside the rolling window
    //      and burning their attempt budgets in parallel.
    //
    //   2. Sliding-window quota. INCR a counter keyed on the
    //      identifier hash; on first hit set the EXPIRE so the
    //      counter ages out after the window. If the counter exceeds
    //      RATE_LIMIT_MAX_PER_WINDOW we 429 — independently of how
    //      many concurrent challenges exist.
    //
    // Both keys hash the identifier so no plaintext email / phone
    // touches Redis. The window key (otp:rl:*) does NOT expire on
    // success — that's the point — but the active key (otp:active:*)
    // shares the challenge TTL so concurrency naturally drops.
    const activePattern = `${ACTIVE_KEY_PREFIX}${identifierHash}:*`;
    const activeKeys = await this.scanKeys(activePattern);
    if (activeKeys.length >= MAX_CONCURRENT_ACTIVE) {
      throw TooManyRequests({
        code: 'otp_active_challenge_quota_exceeded',
        detail: `at most ${MAX_CONCURRENT_ACTIVE} unexpired challenges per identifier`,
      });
    }

    const rlKey = `${RL_KEY_PREFIX}${identifierHash}`;
    const count = await this.redis.incr(rlKey);
    if (count === 1) {
      // First hit in this window — seed the TTL so subsequent INCRs
      // ride a single counter that ages out after exactly the window.
      await this.redis.expire(rlKey, RATE_LIMIT_WINDOW_SECONDS);
    }
    if (count > RATE_LIMIT_MAX_PER_WINDOW) {
      throw TooManyRequests({
        code: 'otp_request_quota_exceeded',
        detail: `at most ${RATE_LIMIT_MAX_PER_WINDOW} challenges per ${Math.round(
          RATE_LIMIT_WINDOW_SECONDS / 60,
        )} minutes for this identifier`,
      });
    }

    const record: ChallengeRecord = {
      userId: input.userId,
      channel: input.channel,
      destination: identifierHash,
      codeHash: sha256Hex(`${challengeId}:${code}`),
      attempts: 0,
      purpose: input.purpose,
      expiresAt,
    };

    await this.redis.set(KEY_PREFIX + challengeId, JSON.stringify(record), 'EX', ttlSeconds);
    // Active-challenge sentinel — value is the challenge id, key
    // carries the identifier hash so the SCAN above can count alive
    // challenges per identifier.
    await this.redis.set(
      `${ACTIVE_KEY_PREFIX}${identifierHash}:${challengeId}`,
      '1',
      'EX',
      ttlSeconds,
    );

    return {
      challengeId,
      code,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * Helper around ioredis SCAN to enumerate matching keys without
   * blocking the server (KEYS pattern would block on a busy instance).
   * Cursor-based; returns the full set of matching keys for the pattern.
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const out: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      out.push(...batch);
      cursor = next;
    } while (cursor !== '0');
    return out;
  }

  /**
   * Verify and consume the challenge. Single-use: success deletes the key,
   * failure increments attempts and may lock out further tries.
   */
  async verifyAndConsume(input: {
    challengeId: string;
    code: string;
    expectedPurpose: 'register_verify' | 'login_mfa' | 'step_up' | 'password_reset';
  }): Promise<UserId> {
    const key = KEY_PREFIX + input.challengeId;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw Unauthorized({ code: 'otp_expired_or_invalid' });
    }
    const record = JSON.parse(raw) as ChallengeRecord;

    if (record.purpose !== input.expectedPurpose) {
      // Burn it — never re-use a challenge across purposes.
      await this.redis.del(key);
      // SEC-012 — release the active-challenge sentinel so the
      // concurrency cap counts only LIVE challenges, not aborted ones.
      await this.redis.del(`${ACTIVE_KEY_PREFIX}${record.destination}:${input.challengeId}`);
      throw BadRequest({ code: 'otp_purpose_mismatch' });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.redis.del(key);
      await this.redis.del(`${ACTIVE_KEY_PREFIX}${record.destination}:${input.challengeId}`);
      throw TooManyRequests({ code: 'otp_attempts_exceeded' });
    }

    const expectedHash = sha256Hex(`${input.challengeId}:${input.code}`);
    const a = Buffer.from(expectedHash, 'hex');
    const b = Buffer.from(record.codeHash, 'hex');
    const ok = a.length === b.length && timingSafeEqual(a, b);

    if (!ok) {
      record.attempts += 1;
      const remainingMs = record.expiresAt - Date.now();
      if (remainingMs > 0) {
        await this.redis.set(key, JSON.stringify(record), 'PX', remainingMs);
      }
      throw Unauthorized({
        code: 'otp_invalid',
        detail: `attempt ${record.attempts} of ${MAX_ATTEMPTS}`,
      });
    }

    await this.redis.del(key);
    // SEC-012 — drop the active-challenge sentinel on successful
    // consume too, so a verified challenge frees its concurrency slot.
    await this.redis.del(`${ACTIVE_KEY_PREFIX}${record.destination}:${input.challengeId}`);
    return record.userId;
  }

  /**
   * Find a prior challenge by id, mark it superseded (delete the Redis
   * keys), and return the metadata callers need to mint a replacement.
   * Used by the resend-OTP endpoint to ensure a fresh code is sent and
   * the old code can never be redeemed afterwards.
   *
   * Why we don't reuse the existing code: rotating the code blocks the
   * single most damaging attack on resend — an attacker triggers a
   * resend, intercepts the SMS/email, and replays the prior code. By
   * minting a brand-new challenge id + code we ensure the prior code is
   * dead the instant supersede returns.
   *
   * Returns null when no live challenge exists. Callers should treat
   * null as "challenge already consumed or expired" — surface a friendly
   * "challenge not found" without leaking which case it was.
   */
  async supersedePriorChallenge(challengeId: string): Promise<{
    userId: UserId;
    channel: 'sms' | 'email' | 'totp';
    purpose: 'register_verify' | 'login_mfa' | 'step_up' | 'password_reset';
    destinationHash: string;
  } | null> {
    const key = KEY_PREFIX + challengeId;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    const record = JSON.parse(raw) as ChallengeRecord;
    await this.redis.del(key);
    await this.redis.del(`${ACTIVE_KEY_PREFIX}${record.destination}:${challengeId}`);
    return {
      userId: record.userId,
      channel: record.channel,
      purpose: record.purpose,
      destinationHash: record.destination,
    };
  }
}
