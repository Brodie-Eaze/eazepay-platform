import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NotFound, BadRequest } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import { PiiVaultService } from './internal/pii-vault.service.js';
import { KYC_PROVIDER, type KycProvider } from './ports/kyc-provider.port.js';
import type { PiiV1 } from './pii.types.js';

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
  profile: PiiV1 | null;
}

export interface StartKycResponse {
  outcome: 'pending' | 'approved' | 'manual_review' | 'rejected' | 'expired';
  providerRef: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: PiiVaultService,
    @Inject(KYC_PROVIDER) private readonly kyc: KycProvider,
  ) {}

  async getMe(userId: UserId): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { consumerProfile: true },
    });
    if (!user) throw NotFound({ code: 'user_not_found' });

    let profile: PiiV1 | null = null;
    if (user.consumerProfile) {
      profile = await this.vault.open(userId, {
        ciphertext: user.consumerProfile.piiCiphertext,
        nonce: user.consumerProfile.piiNonce,
        dataKeyCiphertext: user.consumerProfile.dataKeyCiphertext,
        kekId: user.consumerProfile.kekId,
        schemaVersion: user.consumerProfile.piiSchemaVersion,
      });
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
    };
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
