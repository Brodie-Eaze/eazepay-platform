import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BuzzPayAdapter } from './adapters/buzzpay.adapter.js';
import { MockPrimeAdapter } from './adapters/mock-prime.adapter.js';
import { UsBankLenderAdapter } from './adapters/us-bank.adapter.js';
import { EngineTechLenderAdapter } from './adapters/engine-tech.adapter.js';
import { QueenStreetLenderAdapter } from './adapters/queen-street.adapter.js';
import { LenderRegistry } from './lender-registry.service.js';
import { LENDER_ADAPTERS } from './ports/lender-adapter.port.js';
import { PRISMA } from './internal/tokens.js';

/**
 * Stable string keys for every adapter the platform knows how to
 * instantiate. Adding a new lender = add a class under `adapters/`,
 * import it here, add the key to this union + the switch below, then
 * add the key to the LenderRegistry SEEDS so orchestration can resolve
 * the adapterKey to a DB row.
 *
 * Why this is not a discovery loop over the filesystem: explicit
 * registration is auditable in code-review — a regulator can see in one
 * diff which lenders are wired into prod orchestration.
 */
export type LenderAdapterKey =
  | 'buzzpay'
  | 'mock_prime'
  | 'us_bank'
  | 'engine_tech'
  | 'queen_street';

export interface LenderModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Which adapters to register at runtime. MVP defaults: ['buzzpay', 'mock_prime'].
   *  New scaffold adapters (us_bank, engine_tech, queen_street) can be
   *  registered without credentials — they throw `pending_api_credentials`
   *  at quote() time, which orchestration records as a per-lender failure
   *  rather than crashing the run. */
  adapters: LenderAdapterKey[];
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
        case 'us_bank':
          return UsBankLenderAdapter;
        case 'engine_tech':
          return EngineTechLenderAdapter;
        case 'queen_street':
          return QueenStreetLenderAdapter;
      }
    });

    const adapterArrayProvider: Provider = {
      provide: LENDER_ADAPTERS,
      useFactory: (
        ...instances: Array<
          | BuzzPayAdapter
          | MockPrimeAdapter
          | UsBankLenderAdapter
          | EngineTechLenderAdapter
          | QueenStreetLenderAdapter
        >
      ) => instances,
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
