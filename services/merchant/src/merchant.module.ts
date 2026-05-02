import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';
import { PRISMA } from './internal/tokens.js';
import { KYB_PROVIDER } from './ports/kyb-provider.port.js';
import { MockKybAdapter } from './adapters/mock-kyb.adapter.js';

export interface MerchantModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  kybProvider: 'mock' | 'middesk' | 'alloy';
  isDevelopment: boolean;
}

@Module({})
export class MerchantModule {
  static forRoot(options: MerchantModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const kyb: Provider = {
      provide: KYB_PROVIDER,
      useFactory: () => {
        if (options.kybProvider === 'mock') {
          if (!options.isDevelopment) {
            throw new Error(
              'MockKybAdapter is dev-only — wire Middesk/Alloy for non-development.',
            );
          }
          return new MockKybAdapter();
        }
        throw new Error(`KYB provider ${options.kybProvider} not yet implemented`);
      },
    };

    return {
      module: MerchantModule,
      controllers: [MerchantController],
      providers: [prisma, kyb, MerchantService],
      exports: [MerchantService],
    };
  }
}
