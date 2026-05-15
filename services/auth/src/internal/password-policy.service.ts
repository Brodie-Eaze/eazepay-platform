import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PRISMA } from './tokens.js';

/**
 * SEC-015 — HIBP k-anonymity password check.
 *
 * Threat being closed: the password policy in `register.dto.ts`
 * enforces composition (length, classes, symbol) but lets any
 * sufficiently-strong-looking password through — including ones that
 * already appear in public credential dumps. The single most common
 * cause of MVP-stage account takeover is a user picking
 * "Tr0ub4dor!23" or "P@ssw0rd2024!" — both are strong by composition
 * rules and both appear 1000s of times in HIBP's corpus. Refusing
 * passwords with a known-breach hit lifts a high-value floor at zero
 * cost to the legitimate user.
 *
 * Privacy property: we use Cloudflare-fronted HIBP's k-anonymity API.
 * Workflow:
 *   1. SHA-1 the candidate password.
 *   2. Slice the first 5 hex chars (~20 bits = ~1M prefix buckets).
 *   3. POST the prefix to `https://api.pwnedpasswords.com/range/<prefix>`.
 *   4. The endpoint returns every suffix that shares that prefix
 *      along with its breach count.
 *   5. We match locally; the API host never learns which suffix we
 *      cared about, let alone the plaintext.
 *
 * Fail-open behavior is deliberate. The HIBP API is best-effort
 * external infrastructure — refusing all signups when api.pwnedpasswords.com
 * is unreachable would create a denial-of-service vector. Instead we
 * emit a `risk_signal.hibp_unchecked` audit row so SRE can grep for
 * elevated rates of unchecked signups and the security team can
 * decide whether to flip to fail-closed when the rate spikes
 * (typical bypass attempt: an attacker DDoS-ing the HIBP proxy to
 * sneak a known-breached password past us).
 */
@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);
  /**
   * 2-second timeout. The HIBP API typically responds in <300ms; if
   * we're seeing 2s it's either a network event or HIBP itself is
   * degraded. Failing fast keeps the register path snappy.
   */
  private readonly hibpTimeoutMs = 2_000;

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Returns `{breached: true, count}` if the password appears in HIBP,
   * `{breached: false, count: 0}` otherwise OR on any network / parse
   * error (fail open — see class docstring for the rationale).
   *
   * The audit row written on the fail-open path is searchable by
   * SRE / security via `targetType='RiskSignal'` +
   * `action='risk_signal.hibp_unchecked'`. Spike correlations on
   * those rows feed into the broader fraud-velocity surface.
   */
  async checkBreached(password: string): Promise<{ breached: boolean; count: number }> {
    // HIBP requires SHA-1 specifically — the entire API surface is
    // keyed on the SHA-1 namespace. SHA-1 here is fine because:
    //   - The hash is shipped to a public API that already speaks
    //     SHA-1; we're not storing it.
    //   - Only the first 5 hex chars (~20 bits) leave our process;
    //     the suffix (~140 bits) is matched locally so HIBP can't
    //     reverse the prefix to a plaintext.
    //   - At-rest password storage uses Argon2id (see
    //     LocalIdentityAdapter); this SHA-1 is purely the lookup
    //     protocol the HIBP API expects.
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.hibpTimeoutMs);
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        method: 'GET',
        headers: {
          // Add-Padding is a documented HIBP header that pads the
          // response with synthetic entries — defends against a
          // hostile network observer correlating response size to
          // bucket cardinality. Documented at
          // https://haveibeenpwned.com/API/v3#PwnedPasswords
          'Add-Padding': 'true',
          // No user-supplied data appears in the URL; the User-Agent
          // is for HIBP's abuse logs.
          'User-Agent': 'EazePay-AuthService/1.0 (security@eazepay)',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        await this.recordUnchecked('hibp_http_non_2xx', `status=${res.status}`);
        return { breached: false, count: 0 };
      }
      const text = await res.text();
      // Each line is `SUFFIX:count\r\n` — the hash suffix is uppercase
      // hex and the count is a positive integer. We split on `\r\n`
      // and `\n` to tolerate both line-ending conventions HIBP has
      // emitted historically.
      for (const line of text.split(/\r?\n/)) {
        const idx = line.indexOf(':');
        if (idx <= 0) continue;
        const lineSuffix = line.slice(0, idx).trim().toUpperCase();
        if (lineSuffix !== suffix) continue;
        const count = Number.parseInt(line.slice(idx + 1).trim(), 10);
        if (Number.isFinite(count) && count > 0) {
          return { breached: true, count };
        }
      }
      return { breached: false, count: 0 };
    } catch (err: unknown) {
      // Fail-open path. AbortError is the typical timeout case; a
      // DNS / TCP / TLS error throws a different code but is the same
      // call site — we record one audit row regardless.
      const reason =
        typeof err === 'object' && err !== null && 'name' in err
          ? String((err as { name?: string }).name)
          : 'unknown';
      await this.recordUnchecked('hibp_fetch_error', reason);
      return { breached: false, count: 0 };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Audit row for the fail-open path. Written best-effort — if even
   * the audit write fails we swallow it, because the alternative is
   * blocking signup on a logging failure, which is itself a DoS
   * vector. The Pino logger captures the unexpected error so SRE
   * still has a record.
   *
   * targetType=`RiskSignal` makes this row trivially distinguishable
   * from auth.* rows when the security team builds a HIBP-coverage
   * dashboard later.
   */
  private async recordUnchecked(reason: string, detail: string): Promise<void> {
    try {
      await this.prisma.auditOutbox.create({
        data: {
          actorType: 'system',
          actorId: null,
          action: 'risk_signal.hibp_unchecked',
          targetType: 'RiskSignal',
          targetId: 'hibp',
          after: { reason, detail },
        },
      });
    } catch (auditErr) {
      this.logger.warn(
        { err: auditErr, reason, detail },
        'failed to write hibp_unchecked audit row — swallowing to keep signup non-blocking',
      );
    }
  }
}
