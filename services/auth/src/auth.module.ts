import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LocalIdentityAdapter } from './adapters/local-identity.adapter.js';
import { ConsoleNotificationAdapter } from './adapters/console-notification.adapter.js';
import { LocalTotpVaultAdapter } from './adapters/local-totp-vault.adapter.js';
import { OtpService, REDIS_CLIENT } from './internal/otp.service.js';
import { TokenService, AUTH_CONFIG, type AuthConfig } from './internal/token.service.js';
import { SessionService } from './internal/session.service.js';
import { TotpService } from './internal/totp.service.js';
import { PasswordPolicyService } from './internal/password-policy.service.js';
import { PRISMA } from './internal/tokens.js';
import { IDENTITY_PROVIDER } from './ports/identity-provider.port.js';
import { NOTIFICATION_GATEWAY } from './ports/notification.port.js';
import { TOTP_VAULT, type TotpVaultPort } from './ports/totp-vault.port.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AdminGuard } from './guards/admin.guard.js';

export interface AuthModuleOptions {
  config: AuthConfig;
  /** When 'local', the LocalIdentityAdapter is registered. 'cognito' is
   *  reserved for the production adapter once it lands. */
  provider: 'local' | 'cognito';
  /** Hard guard: console notifications are only allowed in development. */
  isDevelopment: boolean;
  /** Token in the host app's DI container that resolves to a PrismaClient
   *  (e.g. PrismaService extends PrismaClient). */
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Token in the host app's DI container that resolves to a Redis-bearing
   *  service (we read `.client`) or a Redis instance directly. */
  redisToken: symbol | string | (abstract new (...args: never[]) => unknown);
  /**
   * SEC-016 — host-supplied TOTP vault. When omitted, the auth module
   * registers `LocalTotpVaultAdapter`, which uses an env-derived KEK.
   * Production wires a token here that resolves to a class delegating
   * to `PiiVaultService.sealOpaque` (apps/api) so the KEK lives in KMS.
   * The port shape is `TotpVaultPort` — see ports/totp-vault.port.ts.
   */
  totpVaultToken?: symbol | string | (abstract new (...args: never[]) => TotpVaultPort);
}

@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    const prismaProvider: Provider = {
      provide: PRISMA,
      useExisting: options.prismaToken as never,
    };

    const redisProvider: Provider = {
      provide: REDIS_CLIENT,
      useFactory: (host: { client: Redis } | Redis) =>
        'client' in (host as object) ? (host as { client: Redis }).client : (host as Redis),
      inject: [options.redisToken as never],
    };

    const identityProvider: Provider = {
      provide: IDENTITY_PROVIDER,
      useFactory: (prisma: PrismaClient) => {
        if (options.provider === 'local') return new LocalIdentityAdapter(prisma);
        throw new Error('Cognito identity adapter not yet implemented');
      },
      inject: [PRISMA],
    };

    const notificationProvider: Provider = {
      provide: NOTIFICATION_GATEWAY,
      useFactory: () => {
        if (!options.isDevelopment) {
          throw new Error(
            'No production notification adapter wired — refusing to start in non-development without one.',
          );
        }
        return new ConsoleNotificationAdapter();
      },
    };

    // SEC-016 — TOTP vault provider.
    //
    // If the host supplied a token, alias TOTP_VAULT to it (production
    // wires a class that delegates to PiiVaultService.sealOpaque so the
    // KEK lives in KMS). Otherwise register the local adapter which
    // derives the KEK from the JWT secret — fine for dev, NOT FOR PROD.
    // Production deployments are expected to override; if you see this
    // adapter in prod logs, your wiring is incomplete.
    const totpVaultProvider: Provider = options.totpVaultToken
      ? {
          provide: TOTP_VAULT,
          useExisting: options.totpVaultToken as never,
        }
      : {
          provide: TOTP_VAULT,
          useClass: LocalTotpVaultAdapter,
        };

    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: options.config },
        prismaProvider,
        redisProvider,
        identityProvider,
        notificationProvider,
        totpVaultProvider,
        OtpService,
        TokenService,
        SessionService,
        TotpService,
        PasswordPolicyService,
        Reflector,
        JwtAuthGuard,
        AdminGuard,
        AuthService,
        // The local adapter is registered as a self-providing class so
        // useClass resolution above can find it; harmless when the
        // host overrides via totpVaultToken.
        LocalTotpVaultAdapter,
      ],
      exports: [AuthService, TokenService, JwtAuthGuard, AdminGuard],
    };
  }
}
