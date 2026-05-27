import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { SANCTIONS_SCREEN, type SanctionsScreen } from '@eazepay/integrations-core';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';
import { MERCHANT_REGISTRATION_REQUIRES_ADMIN, PRISMA } from './internal/tokens.js';
import { KYB_PROVIDER } from './ports/kyb-provider.port.js';
import { MockKybAdapter } from './adapters/mock-kyb.adapter.js';

export interface MerchantModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  kybProvider: 'mock' | 'middesk' | 'alloy';
  isDevelopment: boolean;
  /**
   * Factory for the OFAC SanctionsScreen adapter. The host application
   * decides which adapter to wire — in development this is the
   * MockOfacAdapter from apps/partner-portal/lib/sanctions; in
   * production it MUST be a real provider (LexisNexis Bridger,
   * ComplyAdvantage, or direct OFAC SDN ingest). See
   * docs/runbooks/sanctions-re-screen.md for the go-live checklist.
   *
   * Required: a missing adapter would let merchant onboarding skip
   * OFAC screening silently. forRoot throws if not provided.
   */
  sanctionsScreen: () => SanctionsScreen;
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

    if (typeof options.sanctionsScreen !== 'function') {
      // Fail loud at module-load — silently skipping OFAC screening is
      // a regulatory finding, not a runtime degradation.
      throw new Error(
        'MerchantModule: sanctionsScreen factory is required. Wire MockOfacAdapter in dev or a real OFAC provider in prod.',
      );
    }
    const sanctions: Provider = {
      provide: SANCTIONS_SCREEN,
      useFactory: () => options.sanctionsScreen(),
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
      providers: [prisma, kyb, sanctions, registrationGate, MerchantService],
      exports: [MerchantService],
    };
  }
}
