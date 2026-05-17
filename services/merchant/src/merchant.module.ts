import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';
import { MERCHANT_REGISTRATION_REQUIRES_ADMIN, PRISMA } from './internal/tokens.js';
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
            throw new Error('MockKybAdapter is dev-only — wire Middesk/Alloy for non-development.');
          }
          return new MockKybAdapter();
        }
        throw new Error(`KYB provider ${options.kybProvider} not yet implemented`);
      },
    };

    // SEC-017 — outside development, `POST /v1/merchants` requires the
    // caller be a platform admin. Development leaves the gate off so
    // existing seed scripts and the local demo flow keep working.
    const registrationGate: Provider = {
      provide: MERCHANT_REGISTRATION_REQUIRES_ADMIN,
      useValue: !options.isDevelopment,
    };

    return {
      module: MerchantModule,
      controllers: [MerchantController],
      providers: [prisma, kyb, registrationGate, MerchantService],
      exports: [MerchantService],
    };
  }
}
