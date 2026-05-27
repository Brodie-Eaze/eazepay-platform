/**
 * Characterization tests for {@link TotpService} + {@link LocalTotpVaultAdapter}.
 *
 * The legacy is the oracle: assertions encode what the code actually
 * does today (RFC 6238 ±1 step, 6-digit, SHA-1 HOTP). Discrepancies
 * between the brief and the implementation are flagged via `it.todo`
 * rather than masking them with a passing test.
 */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ProblemError } from '@eazepay/shared-utils';
import { TotpService } from '../src/internal/totp.service.js';
import { LocalTotpVaultAdapter } from '../src/adapters/local-totp-vault.adapter.js';
import type { AuthConfig } from '../src/internal/token.service.js';
import type { UserId } from '@eazepay/shared-types';

const CONFIG: AuthConfig = {
  jwtIssuer: 'eazepay-test',
  jwtAudience: 'eazepay-test-aud',
  jwtAccessSecret: 'unit-test-totp-secret-padding-padding-pad',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 60 * 60 * 24 * 30,
};

const USER_A = '00000000-0000-4000-8000-000000000aa1' as UserId;
const USER_B = '00000000-0000-4000-8000-000000000bb2' as UserId;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/=/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Locally compute the RFC 6238 TOTP for `secret` at the current epoch,
 *  matching what the implementation expects so we don't have to peek at
 *  the private `verifyCode`. */
function totpAt(secretBase32: string, atMs: number = Date.now()): string {
  const secret = base32Decode(secretBase32);
  const counter = BigInt(Math.floor(Math.floor(atMs / 1000) / 30));
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter, 0);
  const mac = createHmac('sha1', secret).update(counterBuf).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binCode =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  return (binCode % 1_000_000).toString().padStart(6, '0');
}

describe('LocalTotpVaultAdapter — AES-256-GCM envelope round-trip', () => {
  const vault = new LocalTotpVaultAdapter(CONFIG);

  it('seal then open yields the original base32 secret', async () => {
    const secretBase32 = 'JBSWY3DPEHPK3PXP'; // RFC 4648 test vector
    const envelope = await vault.sealTotpSecret({ userId: USER_A, secretBase32 });
    const opened = await vault.openTotpSecret({ userId: USER_A, envelope });
    expect(opened).toBe(secretBase32);
  });

  it('refuses to open with a different userId (AAD binding closes row-swap)', async () => {
    const envelope = await vault.sealTotpSecret({
      userId: USER_A,
      secretBase32: 'JBSWY3DPEHPK3PXP',
    });
    await expect(
      vault.openTotpSecret({ userId: USER_B, envelope }),
    ).rejects.toMatchObject({ problem: { code: 'totp_envelope_user_mismatch', status: 401 } });
  });

  it('rejects a malformed envelope with totp_envelope_malformed', async () => {
    await expect(
      vault.openTotpSecret({ userId: USER_A, envelope: 'this-is-not-base64-json' }),
    ).rejects.toMatchObject({ problem: { code: 'totp_envelope_malformed' } });
  });

  it('rejects an envelope with an unknown version', async () => {
    const futureEnvelope = Buffer.from(
      JSON.stringify({
        v: 99,
        ct: 'AA',
        n: 'AA',
        t: 'AA',
        aad: { scope: 'totp_secret', userId: USER_A },
      }),
      'utf8',
    ).toString('base64');
    await expect(
      vault.openTotpSecret({ userId: USER_A, envelope: futureEnvelope }),
    ).rejects.toMatchObject({ problem: { code: 'totp_envelope_version_unknown' } });
  });

  it('every seal call produces a fresh nonce (non-deterministic ciphertext)', async () => {
    const a = await vault.sealTotpSecret({ userId: USER_A, secretBase32: 'JBSWY3DPEHPK3PXP' });
    const b = await vault.sealTotpSecret({ userId: USER_A, secretBase32: 'JBSWY3DPEHPK3PXP' });
    expect(a).not.toBe(b);
  });
});

describe('TotpService.initEnrolment', () => {
  const vault = new LocalTotpVaultAdapter(CONFIG);
  const svc = new TotpService(vault);

  it('returns a base32 secret + otpauth URI + 10 formatted recovery codes', async () => {
    const r = await svc.initEnrolment({ userId: USER_A, accountLabel: 'user@example.com' });
    expect(r.secret).toMatch(/^[A-Z2-7]+$/); // RFC 4648 base32, no padding
    expect(r.otpauthUri).toContain(`secret=${r.secret}`);
    expect(r.otpauthUri).toContain('issuer=EazePay');
    expect(r.otpauthUri).toContain('algorithm=SHA1');
    expect(r.otpauthUri).toContain('digits=6');
    expect(r.otpauthUri).toContain('period=30');
    expect(r.recoveryCodesPlaintext).toHaveLength(10);
    for (const code of r.recoveryCodesPlaintext) {
      expect(code).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    }
  });
});

describe('TotpService.commitEnrolment — verify with ±1 step skew window', () => {
  const vault = new LocalTotpVaultAdapter(CONFIG);
  const svc = new TotpService(vault);

  it('accepts the current-window TOTP code and returns a sealed envelope + hashed codes', async () => {
    const init = await svc.initEnrolment({ userId: USER_A, accountLabel: 'u@e.com' });
    const code = totpAt(init.secret);
    const committed = await svc.commitEnrolment({
      userId: USER_A,
      secret: init.secret,
      code,
      recoveryCodesPlaintext: init.recoveryCodesPlaintext,
    });
    expect(committed.sealedSecret).toBeTypeOf('string');
    expect(committed.recoveryCodes).toHaveLength(10);
    for (const c of committed.recoveryCodes) {
      expect(c.used).toBe(false);
      expect(c.hash).toMatch(/^\$argon2id\$/);
    }
  });

  it('accepts a code from the previous 30s step (skew window negative)', async () => {
    const init = await svc.initEnrolment({ userId: USER_A, accountLabel: 'u@e.com' });
    const previousStepCode = totpAt(init.secret, Date.now() - 30_000);
    const committed = await svc.commitEnrolment({
      userId: USER_A,
      secret: init.secret,
      code: previousStepCode,
      recoveryCodesPlaintext: init.recoveryCodesPlaintext,
    });
    expect(committed.sealedSecret).toBeTypeOf('string');
  });

  it('accepts a code from the next 30s step (skew window positive)', async () => {
    const init = await svc.initEnrolment({ userId: USER_A, accountLabel: 'u@e.com' });
    const nextStepCode = totpAt(init.secret, Date.now() + 30_000);
    const committed = await svc.commitEnrolment({
      userId: USER_A,
      secret: init.secret,
      code: nextStepCode,
      recoveryCodesPlaintext: init.recoveryCodesPlaintext,
    });
    expect(committed.sealedSecret).toBeTypeOf('string');
  });

  it('rejects a code 2 steps away (outside the ±1 window) with otp_invalid', async () => {
    const init = await svc.initEnrolment({ userId: USER_A, accountLabel: 'u@e.com' });
    const farCode = totpAt(init.secret, Date.now() + 90_000); // 3 steps ahead
    await expect(
      svc.commitEnrolment({
        userId: USER_A,
        secret: init.secret,
        code: farCode,
        recoveryCodesPlaintext: init.recoveryCodesPlaintext,
      }),
    ).rejects.toMatchObject({ problem: { code: 'otp_invalid', status: 401 } });
  });

  it('rejects a code that is not 6 digits outright', async () => {
    const init = await svc.initEnrolment({ userId: USER_A, accountLabel: 'u@e.com' });
    await expect(
      svc.commitEnrolment({
        userId: USER_A,
        secret: init.secret,
        code: '12345', // 5 digits
        recoveryCodesPlaintext: init.recoveryCodesPlaintext,
      }),
    ).rejects.toBeInstanceOf(ProblemError);
  });

  it('rejects when the recovery-code array is the wrong length', async () => {
    const init = await svc.initEnrolment({ userId: USER_A, accountLabel: 'u@e.com' });
    const code = totpAt(init.secret);
    await expect(
      svc.commitEnrolment({
        userId: USER_A,
        secret: init.secret,
        code,
        recoveryCodesPlaintext: init.recoveryCodesPlaintext.slice(0, 5),
      }),
    ).rejects.toMatchObject({ problem: { code: 'totp_recovery_code_count_mismatch' } });
  });
});

describe('TotpService.verifyChallenge — login-time second factor', () => {
  const vault = new LocalTotpVaultAdapter(CONFIG);
  const svc = new TotpService(vault);

  async function enrol() {
    const init = await svc.initEnrolment({ userId: USER_A, accountLabel: 'u@e.com' });
    const code = totpAt(init.secret);
    const committed = await svc.commitEnrolment({
      userId: USER_A,
      secret: init.secret,
      code,
      recoveryCodesPlaintext: init.recoveryCodesPlaintext,
    });
    return { init, committed };
  }

  it('returns kind=totp_ok for a valid TOTP code', async () => {
    const { init, committed } = await enrol();
    const code = totpAt(init.secret);
    const result = await svc.verifyChallenge({
      userId: USER_A,
      submittedCode: code,
      sealedSecret: committed.sealedSecret,
      recoveryCodes: committed.recoveryCodes,
    });
    expect(result.kind).toBe('totp_ok');
  });

  it('redeems a recovery code: returns updated array with that slot marked used + remaining count', async () => {
    const { init, committed } = await enrol();
    const recoveryPlain = init.recoveryCodesPlaintext[0]!;
    const result = await svc.verifyChallenge({
      userId: USER_A,
      submittedCode: recoveryPlain,
      sealedSecret: committed.sealedSecret,
      recoveryCodes: committed.recoveryCodes,
    });
    if (result.kind !== 'recovery_code_ok') throw new Error('expected recovery_code_ok');
    expect(result.remaining).toBe(9);
    const usedSlots = result.updatedRecoveryCodes.filter((s) => s.used);
    expect(usedSlots).toHaveLength(1);
    expect(usedSlots[0]!.usedAt).toBeTypeOf('string');
  });

  it('rejects a recovery code that has already been marked used (single-use)', async () => {
    const { init, committed } = await enrol();
    const recoveryPlain = init.recoveryCodesPlaintext[0]!;
    // First redemption marks slot 0 used.
    const first = await svc.verifyChallenge({
      userId: USER_A,
      submittedCode: recoveryPlain,
      sealedSecret: committed.sealedSecret,
      recoveryCodes: committed.recoveryCodes,
    });
    if (first.kind !== 'recovery_code_ok') throw new Error('expected recovery_code_ok');
    // Re-presenting against the post-burn array must fail.
    await expect(
      svc.verifyChallenge({
        userId: USER_A,
        submittedCode: recoveryPlain,
        sealedSecret: committed.sealedSecret,
        recoveryCodes: first.updatedRecoveryCodes,
      }),
    ).rejects.toMatchObject({ problem: { code: 'otp_invalid' } });
  });

  it('rejects a wrong TOTP code AND a wrong recovery code with otp_invalid', async () => {
    const { committed } = await enrol();
    await expect(
      svc.verifyChallenge({
        userId: USER_A,
        submittedCode: '000000', // overwhelmingly unlikely to match the current window
        sealedSecret: committed.sealedSecret,
        recoveryCodes: committed.recoveryCodes,
      }),
    ).rejects.toMatchObject({ problem: { code: 'otp_invalid' } });
  });

  it.todo(
    'rejects replay of the SAME valid TOTP code within the 30s window — CURRENT CODE DOES NOT TRACK USED CODES; flag for SEC review (RULE-TOTP-REPLAY)',
  );
});
