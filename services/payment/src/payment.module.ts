import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LoanController } from './loan.controller.js';
import { PaymentService } from './payment.service.js';
import { PRISMA } from './internal/tokens.js';
import { PAYMENT_PROVIDER } from './ports/payment-provider.port.js';
import { MockPaymentAdapter } from './adapters/mock-payment.adapter.js';

export interface PaymentModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** 'mock' for dev. Production: 'modern_treasury' | 'stripe' | 'partner_bank'. */
  provider: 'mock' | 'modern_treasury' | 'stripe' | 'partner_bank';
  isDevelopment: boolean;
}

@Module({})
export class PaymentModule {
  static forRoot(options: PaymentModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const provider: Provider = {
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

    return {
      module: PaymentModule,
      controllers: [LoanController],
      providers: [prisma, provider, PaymentService],
      exports: [PaymentService],
    };
  }
}
