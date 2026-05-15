import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NotFound, BadRequest, Forbidden } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import { PiiVaultService } from './internal/pii-vault.service.js';
import { KYC_PROVIDER, type KycProvider } from './ports/kyc-provider.port.js';
import type { PiiV1 } from './pii.types.js';

/**
 * SEC-023 — masked PII shape returned by GET /v1/me by default.
 *
 * The mask follows a "show enough to confirm the right account is
 * loaded, hide everything else" rule:
 *   - legalName.first stays (it's effectively a display name); `last`
 *     becomes the first initial only, `middle`/`suffix` drop entirely.
 *   - dateOfBirth keeps the year so the consumer can verify "yes, this
 *     is my account", but day + month are blanked.
 *   - ssnLast4 collapses to '***' — surfacing even four digits of an
 *     SSN to a stolen JWT is unnecessary risk.
 *   - address.line1/line2 hide entirely (they're identifying); zip
 *     truncates to the first three chars (US ZIP3 is non-identifying
 *     and still useful for "is this the right state?" verification);
 *     city + state stay (low sensitivity, recognisable).
 *
 * Plaintext is only returned when the caller passes `?reveal=full`
 * AND has a fresh OTP step-up — see `assertFreshStepUp`.
 */
export interface PiiV1Masked {
  legalName: { first: string; last: string };
  dateOfBirth: string;
  ssnLast4: '***' | null;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface MeResponse {
  userId: UserId;
  email: string | null;
  phone: string | null;
  status: string;
  kyc: {
    status: string;
    pep: string;
    sanctions: string;
    completedAt: string | null;
  };
  /** Either the masked subset (default) or full plaintext PII (only
   *  when reveal=full AND step-up satisfied). Null when no profile
   *  exists. */
  profile: PiiV1 | PiiV1Masked | null;
  /** Discriminator so the client knows whether to prompt for step-up
   *  before showing edit forms. */
  profileVisibility: 'masked' | 'full' | 'absent';
}

export interface StartKycResponse {
  outcome: 'pending' | 'approved' | 'manual_review' | 'rejected' | 'expired';
  providerRef: string;
}

interface GetMeOptions {
  /** 'masked' (default) returns the safe subset; 'full' returns
   *  plaintext but requires a fresh OTP step-up. */
  reveal: 'masked' | 'full';
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: PiiVaultService,
    @Inject(KYC_PROVIDER) private readonly kyc: KycProvider,
  ) {}

  async getMe(
    userId: UserId,
    options: GetMeOptions = { reveal: 'masked' },
  ): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { consumerProfile: true },
    });
    if (!user) throw NotFound({ code: 'user_not_found' });

    let profile: PiiV1 | PiiV1Masked | null = null;
    let visibility: 'masked' | 'full' | 'absent' = 'absent';
    if (user.consumerProfile) {
      const full = await this.vault.open(userId, {
        ciphertext: user.consumerProfile.piiCiphertext,
        nonce: user.consumerProfile.piiNonce,
        dataKeyCiphertext: user.consumerProfile.dataKeyCiphertext,
        kekId: user.consumerProfile.kekId,
        schemaVersion: user.consumerProfile.piiSchemaVersion,
      });
      if (options.reveal === 'full') {
        // SEC-023 — plaintext requires a fresh OTP step-up. Until the
        // step-up wiring lands (see otp.service.ts `purpose: 'step_up'`
        // mechanism), we deliberately fail closed: any caller asking
        // for `?reveal=full` gets a 403 with a machine-readable code
        // so the consumer-web app can drive the step-up flow. This
        // closes the "stolen JWT == one-shot PII dump" hole NOW; the
        // legitimate reveal path lands in a follow-up.
        //
        // TODO(SEC-023 follow-up): accept a `x-step-up-challenge` or
        // session-flag check from otp.service that confirms the user
        // completed a `purpose: 'reveal_profile'` OTP within the last
        // 5 minutes, then return `full` instead of throwing.
        await this.assertFreshStepUp(userId);
        profile = full;
        visibility = 'full';
      } else {
        profile = mask(full);
        visibility = 'masked';
      }
    }

    return {
      userId,
      email: user.email,
      phone: user.phoneE164,
      status: user.status,
      kyc: {
        status: user.consumerProfile?.kycStatus ?? 'not_started',
        pep: user.consumerProfile?.pepStatus ?? 'unknown',
        sanctions:
          user.consumerProfile?.sanctionsCheckedAt ? 'cleared' : 'unknown',
        completedAt:
          user.consumerProfile?.kycCompletedAt?.toISOString() ?? null,
      },
      profile,
      profileVisibility: visibility,
    };
  }

  /**
   * SEC-023 — step-up gate for plaintext PII reveal.
   *
   * Until the actual step-up handshake is plumbed end-to-end (the
   * controller would accept a step-up challenge id and this service
   * would call OtpService.verifyAndConsume with purpose='step_up'),
   * we fail closed. This is an explicit safety choice: better to
   * 403 every reveal=full call than to silently return plaintext on
   * a stale guard.
   *
   * The error code is machine-readable so the consumer-web app can
   * recognise it and start the step-up dance instead of showing a
   * generic "access denied" toast.
   */
  private async assertFreshStepUp(_userId: UserId): Promise<void> {
    throw Forbidden({
      code: 'step_up_required',
      detail:
        'Plaintext profile reveal requires a fresh OTP step-up. Complete the step-up flow and retry within 5 minutes.',
    });
  }

  /**
   * Upsert the encrypted PII blob. Mutating PII after KYC approval
   * triggers re-verification — implemented as a kyc_status reset to
   * `not_started` plus an audit row capturing the change reason.
   */
  async updateProfile(userId: UserId, pii: PiiV1): Promise<MeResponse> {
    const sealed = await this.vault.seal(userId, pii);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.consumerProfile.findUnique({
        where: { userId },
        select: { id: true, kycStatus: true },
      });

      const requiresRekyc =
        existing && existing.kycStatus !== 'not_started' && existing.kycStatus !== 'rejected';

      await tx.consumerProfile.upsert({
        where: { userId },
        create: {
          userId,
          piiCiphertext: sealed.ciphertext,
          piiNonce: sealed.nonce,
          dataKeyCiphertext: sealed.dataKeyCiphertext,
          kekId: sealed.kekId,
          piiSchemaVersion: sealed.schemaVersion,
          residentState: pii.address.state,
        },
        update: {
          piiCiphertext: sealed.ciphertext,
          piiNonce: sealed.nonce,
          dataKeyCiphertext: sealed.dataKeyCiphertext,
          kekId: sealed.kekId,
          piiSchemaVersion: sealed.schemaVersion,
          residentState: pii.address.state,
          ...(requiresRekyc
            ? { kycStatus: 'not_started', kycCompletedAt: null }
            : {}),
        },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: existing ? 'user.profile.updated' : 'user.profile.created',
          targetType: 'ConsumerProfile',
          targetId: userId,
          after: { residentState: pii.address.state, requiresRekyc: !!requiresRekyc },
        },
      });
    });

    return this.getMe(userId);
  }

  async startKyc(
    userId: UserId,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<StartKycResponse> {
    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw BadRequest({
        code: 'profile_required',
        detail: 'PATCH /v1/me with profile data before initiating KYC',
      });
    }
    if (profile.kycStatus === 'approved') {
      return { outcome: 'approved', providerRef: profile.kycProviderRef ?? '' };
    }

    const pii = await this.vault.open(userId, {
      ciphertext: profile.piiCiphertext,
      nonce: profile.piiNonce,
      dataKeyCiphertext: profile.dataKeyCiphertext,
      kekId: profile.kekId,
      schemaVersion: profile.piiSchemaVersion,
    });

    const result = await this.kyc.initiate({ userId, pii, ipAddress, userAgent });
    const status = await this.kyc.status(result.providerRef);

    await this.prisma.$transaction(async (tx) => {
      await tx.consumerProfile.update({
        where: { userId },
        data: {
          kycStatus:
            status.outcome === 'approved'
              ? 'approved'
              : status.outcome === 'manual_review'
                ? 'manual_review'
                : status.outcome === 'rejected'
                  ? 'rejected'
                  : 'in_progress',
          kycProviderRef: result.providerRef,
          kycLastCheckedAt: new Date(),
          kycCompletedAt: status.outcome === 'approved' ? new Date() : null,
          pepStatus:
            status.pep === 'cleared' ? 'cleared' : status.pep === 'match' ? 'match' : 'unknown',
          sanctionsCheckedAt:
            status.sanctions === 'cleared' || status.sanctions === 'match' ? new Date() : null,
        },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'user.kyc.initiated',
          targetType: 'ConsumerProfile',
          targetId: userId,
          after: {
            providerRef: result.providerRef,
            outcome: status.outcome,
            reasonCodes: status.reasonCodes,
            ipAddress,
            userAgent,
          },
        },
      });
    });

    return { outcome: status.outcome, providerRef: result.providerRef };
  }
}

/**
 * SEC-023 — produce the masked view of a ConsumerProfile.
 *
 * The shape mirrors PiiV1 closely so client code that already binds
 * to `profile.legalName.first` keeps working; only the *values* shrink.
 * Anything we can't safely shrink (an empty `last`) is rendered as the
 * empty string rather than `null` so the type contract stays simple
 * for downstream consumers.
 */
function mask(full: PiiV1): PiiV1Masked {
  // Defensive narrowing: the upstream PiiV1 zod inference depends on
  // `UsStateSchema` / `UsZipSchema` imports that are currently broken
  // in @eazepay/shared-types, so the inferred field types fall back to
  // `unknown`. Coerce to string locally — at runtime these are always
  // strings (the seal/open path round-trips JSON), and once the
  // shared-types import is repaired this narrowing becomes a no-op.
  const addr = full.address as {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  };
  const name = full.legalName as {
    first: string;
    middle?: string;
    last: string;
    suffix?: string;
  };
  const dob = String(full.dateOfBirth ?? '');
  const lastInitial = name.last ? `${name.last[0]}.` : '';
  const year = dob.slice(0, 4);
  const zip3 = (addr.zip ?? '').slice(0, 3);
  return {
    legalName: {
      first: name.first,
      last: lastInitial,
    },
    dateOfBirth: `${year}-**-**`,
    ssnLast4: full.ssnLast4 ? '***' : null,
    address: {
      line1: '***',
      line2: '***',
      city: addr.city,
      state: addr.state,
      zip: zip3,
    },
  };
}
