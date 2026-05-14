import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from '../internal/tokens.js';
import { hash, verify } from '@node-rs/argon2';
// Algorithm.Argon2id is an ambient const enum; we use the numeric value
// directly to avoid the isolatedModules const-enum restriction.
const ARGON2_ID = 2;
import { Conflict, Unauthorized } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import type {
  IdentityCheckPasswordInput,
  IdentityProvider,
  IdentitySignUpInput,
  IdentitySignUpResult,
} from '../ports/identity-provider.port.js';

const ARGON2_OPTS = {
  algorithm: ARGON2_ID,
  memoryCost: 19_456, // ~19 MiB — OWASP 2024 recommendation
  timeCost: 2,
  parallelism: 1,
};

/**
 * Dev / non-Cognito path. Stores Argon2id hash in `users.password_hash`.
 * Identifier resolution: email OR phone, both unique. Constant-time
 * password comparison via @node-rs/argon2 verify().
 */
@Injectable()
export class LocalIdentityAdapter implements IdentityProvider {
  private readonly logger = new Logger(LocalIdentityAdapter.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async signUp(input: IdentitySignUpInput): Promise<IdentitySignUpResult> {
    if (!input.email && !input.phone) {
      throw Conflict({ code: 'identifier_required', detail: 'email or phone is required' });
    }

    const passwordHash = await hash(input.password, ARGON2_OPTS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email ?? null,
          phoneE164: input.phone ?? null,
          passwordHash,
        },
        select: { id: true },
      });
      return {
        externalId: user.id,
        userId: user.id as UserId,
      };
    } catch (err: unknown) {
      // Prisma throws P2002 on unique constraint. We never disclose which
      // field collided — registration enumeration mitigation.
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: string }).code === 'P2002'
      ) {
        throw Conflict({
          code: 'account_exists',
          detail: 'an account with that identifier already exists',
        });
      }
      throw err;
    }
  }

  async checkPassword(input: IdentityCheckPasswordInput): Promise<UserId> {
    const isEmail = input.identifier.includes('@');
    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: input.identifier.toLowerCase() }
        : { phoneE164: input.identifier },
      select: { id: true, passwordHash: true, status: true },
    });

    // Always verify against a dummy hash if user is missing, to keep
    // response time constant and prevent user-enumeration via timing.
    const hashToCheck =
      user?.passwordHash ??
      // Pre-computed valid Argon2id hash of the string "dummy" — value
      // doesn't matter, only that verify() runs the full work factor.
      '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    const ok = await verify(hashToCheck, input.password);

    if (!ok || !user) {
      throw Unauthorized({ code: 'invalid_credentials' });
    }
    if (user.status === 'locked' || user.status === 'closed') {
      throw Unauthorized({ code: 'account_unavailable' });
    }
    return user.id as UserId;
  }
}
