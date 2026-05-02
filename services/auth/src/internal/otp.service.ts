import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { sha256Hex, BadRequest, TooManyRequests, Unauthorized } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

interface ChallengeRecord {
  userId: UserId;
  channel: 'sms' | 'email' | 'totp';
  destination: string; // hashed; never plaintext
  codeHash: string;
  attempts: number;
  purpose: 'register_verify' | 'login_mfa' | 'step_up';
  expiresAt: number; // ms epoch
}

const MAX_ATTEMPTS = 5;
const DEFAULT_TTL_SECONDS = 600; // 10 minutes
const KEY_PREFIX = 'otp:';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async createChallenge(input: {
    userId: UserId;
    channel: 'sms' | 'email' | 'totp';
    destination: string;
    purpose: 'register_verify' | 'login_mfa' | 'step_up';
    ttlSeconds?: number;
  }): Promise<{ challengeId: string; code: string; expiresAt: string }> {
    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const record: ChallengeRecord = {
      userId: input.userId,
      channel: input.channel,
      destination: sha256Hex(input.destination),
      codeHash: sha256Hex(`${challengeId}:${code}`),
      attempts: 0,
      purpose: input.purpose,
      expiresAt,
    };

    await this.redis.set(KEY_PREFIX + challengeId, JSON.stringify(record), 'EX', ttlSeconds);

    return {
      challengeId,
      code,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * Verify and consume the challenge. Single-use: success deletes the key,
   * failure increments attempts and may lock out further tries.
   */
  async verifyAndConsume(input: {
    challengeId: string;
    code: string;
    expectedPurpose: 'register_verify' | 'login_mfa' | 'step_up';
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
      throw BadRequest({ code: 'otp_purpose_mismatch' });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.redis.del(key);
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
    return record.userId;
  }
}
