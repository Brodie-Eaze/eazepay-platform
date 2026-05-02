import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LoanController } from './loan.controller.js';
import { PaymentMethodController } from './payment-method.controller.js';
import { PaymentService } from './payment.service.js';
import { PRISMA } from './internal/tokens.js';
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
  /** Whether the daily collection cron is enabled in this process.
   *  In a multi-process deploy, only ONE replica should run it. */
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
    if (options.collectionCronEnabled) providers.push(CollectionScheduler);

    return {
      module: PaymentModule,
      controllers: [LoanController, PaymentMethodController],
      providers,
      exports: [PaymentService],
    };
  }
}
