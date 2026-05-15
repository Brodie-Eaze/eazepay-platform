import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LoanController } from './loan.controller.js';
import { PaymentMethodController } from './payment-method.controller.js';
import { PaymentService } from './payment.service.js';
import { COLLECTION_CRON_OPTIONS, PRISMA } from './internal/tokens.js';
import { PAYMENT_PROVIDER } from './ports/payment-provider.port.js';
import { BANK_ACCOUNT_PROVIDER } from './ports/bank-account-provider.port.js';
import { MockPaymentAdapter } from './adapters/mock-payment.adapter.js';
import { MockBankAccountAdapter } from './adapters/mock-bank-account.adapter.js';
import { CollectionScheduler } from './internal/collection-scheduler.service.js';

export interface PaymentModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Money-rail provider. 'mock' for dev. */
  provider: 'mock' | 'modern_treasury' | 'stripe' | 'partner_bank';
  /** Bank-linking provider for adding consumer bank accounts. */
  bankAccountProvider: 'mock' | 'plaid' | 'mx' | 'finicity';
  /** Umbrella leader gate — set by the caller from `env.CRON_LEADER`.
   *  When false on a replica, NO cron in this process fires, even if
   *  `collectionCronEnabled` is true. Multi-replica safety lives
   *  here. */
  cronLeader: boolean;
  /** Per-cron kill-switch for the daily collection sweep. Independent
   *  of `cronLeader` so operators can pause collections during an
   *  incident without disabling other crons. Both flags must be true
   *  for the cron to fire. */
  collectionCronEnabled: boolean;
  isDevelopment: boolean;
}

@Module({})
export class PaymentModule {
  static forRoot(options: PaymentModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const paymentProvider: Provider = {
      provide: PAYMENT_PROVIDER,
      useFactory: () => {
        if (options.provider === 'mock') {
          if (!options.isDevelopment) {
            throw new Error(
              'MockPaymentAdapter is dev-only — wire Modern Treasury / Stripe / partner-bank ACH for non-development.',
            );
          }
          return new MockPaymentAdapter();
        }
        throw new Error(`Payment provider ${options.provider} not yet implemented`);
      },
    };

    const bankProvider: Provider = {
      provide: BANK_ACCOUNT_PROVIDER,
      useFactory: () => {
        if (options.bankAccountProvider === 'mock') {
          if (!options.isDevelopment) {
            throw new Error(
              'MockBankAccountAdapter is dev-only — wire Plaid / MX / Finicity for non-development.',
            );
          }
          return new MockBankAccountAdapter();
        }
        throw new Error(
          `Bank account provider ${options.bankAccountProvider} not yet implemented`,
        );
      },
    };

    const providers: Provider[] = [
      prisma,
      paymentProvider,
      bankProvider,
      PaymentService,
    ];
    // Provider-registration gate: scheduler class is only instantiated
    // when BOTH flags are true. The handler-entry check inside the
    // service is defense in depth on top of this.
    const cronShouldRun = options.cronLeader && options.collectionCronEnabled;
    if (cronShouldRun) {
      providers.push({
        provide: COLLECTION_CRON_OPTIONS,
        useValue: {
          cronLeader: options.cronLeader,
          collectionCronEnabled: options.collectionCronEnabled,
        },
      });
      providers.push(CollectionScheduler);
    }

    return {
      module: PaymentModule,
      global: true,
      controllers: [LoanController, PaymentMethodController],
      providers,
      exports: [PaymentService],
    };
  }
}
