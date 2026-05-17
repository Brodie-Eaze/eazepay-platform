import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { UserModule } from '@eazepay/service-user';
import { AuthModule } from '@eazepay/service-auth';
import { BillingController } from './billing.controller.js';
import { BillingConfirmController } from './billing-confirm.controller.js';
import { BillingService } from './billing.service.js';
import { ACTIVITY_SOURCE, CONFIRM_TOKEN_TTL_HOURS, PRISMA } from './internal/tokens.js';
import { MockActivitySource } from './adapters/mock-activity-source.adapter.js';
import type { ActivitySource } from './ports/activity-source.port.js';

export interface BillingModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Source of funded-volume data per period. 'mock' is dev/staging only. */
  activitySource: 'mock' | 'settlements';
  isDevelopment: boolean;
  /** Confirm/dispute token TTL. Default 30 days. */
  confirmTokenTtlHours?: number;
}

@Module({})
export class BillingModule {
  static forRoot(options: BillingModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const activity: Provider = {
      provide: ACTIVITY_SOURCE,
      inject: [PRISMA],
      useFactory: (prismaClient: PrismaClient): ActivitySource => {
        if (options.activitySource === 'mock') {
          if (!options.isDevelopment) {
            throw new Error(
              'MockActivitySource is dev-only — wire the settlements ledger for non-development.',
            );
          }
          return new MockActivitySource(prismaClient);
        }
        // 'settlements' adapter is the next PR — until then, refuse to
        // boot the service outside dev rather than silently using mock.
        throw new Error(
          `Activity source "${options.activitySource}" not yet implemented; provide settlements adapter.`,
        );
      },
    };

    const ttl: Provider = {
      provide: CONFIRM_TOKEN_TTL_HOURS,
      useValue: options.confirmTokenTtlHours ?? 24 * 30,
    };

    return {
      module: BillingModule,
      imports: [AuthModule, UserModule],
      controllers: [BillingController, BillingConfirmController],
      providers: [prisma, activity, ttl, BillingService],
      exports: [BillingService],
    };
  }
}
