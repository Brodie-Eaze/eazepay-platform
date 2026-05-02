import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from './internal/tokens.js';
import { DEVICE_RISK_PROVIDER } from './ports/device-risk.port.js';
import { IDENTITY_RISK_PROVIDER } from './ports/identity-risk.port.js';
import { MockDeviceRiskAdapter } from './adapters/mock-device-risk.adapter.js';
import { MockIdentityRiskAdapter } from './adapters/mock-identity-risk.adapter.js';
import { RiskService } from './risk.service.js';

export interface RiskModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  deviceProvider: 'mock' | 'sift' | 'castle' | 'seon' | 'plaid_signal';
  identityProvider: 'mock' | 'emailage' | 'telesign' | 'ekata';
  isDevelopment: boolean;
}

@Module({})
export class RiskModule {
  static forRoot(options: RiskModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const ensureDev = (kind: string, choice: string): void => {
      if (choice === 'mock' && !options.isDevelopment) {
        throw new Error(
          `Mock ${kind} risk adapter is dev-only — wire a production provider for non-development.`,
        );
      }
    };
    ensureDev('device', options.deviceProvider);
    ensureDev('identity', options.identityProvider);

    const deviceProvider: Provider = {
      provide: DEVICE_RISK_PROVIDER,
      useFactory: () => {
        if (options.deviceProvider === 'mock') return new MockDeviceRiskAdapter();
        throw new Error(`Device risk provider ${options.deviceProvider} not yet implemented`);
      },
    };
    const identityProvider: Provider = {
      provide: IDENTITY_RISK_PROVIDER,
      useFactory: () => {
        if (options.identityProvider === 'mock') return new MockIdentityRiskAdapter();
        throw new Error(`Identity risk provider ${options.identityProvider} not yet implemented`);
      },
    };

    return {
      module: RiskModule,
      // Global so orchestration / payment / admin can inject RiskService
      // without re-importing the full provider configuration.
      global: true,
      providers: [prisma, deviceProvider, identityProvider, RiskService],
      exports: [RiskService],
    };
  }
}
