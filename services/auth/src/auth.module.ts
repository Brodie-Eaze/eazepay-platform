import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LocalIdentityAdapter } from './adapters/local-identity.adapter.js';
import { ConsoleNotificationAdapter } from './adapters/console-notification.adapter.js';
import { OtpService, REDIS_CLIENT } from './internal/otp.service.js';
import { TokenService, AUTH_CONFIG, type AuthConfig } from './internal/token.service.js';
import { SessionService } from './internal/session.service.js';
import { PRISMA } from './internal/tokens.js';
import { IDENTITY_PROVIDER } from './ports/identity-provider.port.js';
import { NOTIFICATION_GATEWAY } from './ports/notification.port.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

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

    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: options.config },
        prismaProvider,
        redisProvider,
        identityProvider,
        notificationProvider,
        OtpService,
        TokenService,
        SessionService,
        JwtAuthGuard,
        AuthService,
      ],
      exports: [AuthService, TokenService, JwtAuthGuard],
    };
  }
}
