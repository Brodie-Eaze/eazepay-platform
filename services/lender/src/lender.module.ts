import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BuzzPayAdapter } from './adapters/buzzpay.adapter.js';
import { MockPrimeAdapter } from './adapters/mock-prime.adapter.js';
import { LenderRegistry } from './lender-registry.service.js';
import { LENDER_ADAPTERS } from './ports/lender-adapter.port.js';
import { PRISMA } from './internal/tokens.js';

export interface LenderModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Which adapters to register at runtime. MVP defaults: ['buzzpay', 'mock_prime']. */
  adapters: Array<'buzzpay' | 'mock_prime'>;
}

@Module({})
export class LenderModule {
  static forRoot(options: LenderModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const adapterClasses = options.adapters.map((key) => {
      switch (key) {
        case 'buzzpay':
          return BuzzPayAdapter;
        case 'mock_prime':
          return MockPrimeAdapter;
      }
    });

    const adapterArrayProvider: Provider = {
      provide: LENDER_ADAPTERS,
      useFactory: (...instances: BuzzPayAdapter[] | MockPrimeAdapter[]) => instances,
      inject: adapterClasses,
    };

    return {
      module: LenderModule,
      global: true,
      providers: [prisma, ...adapterClasses, adapterArrayProvider, LenderRegistry],
      exports: [LenderRegistry],
    };
  }
}
