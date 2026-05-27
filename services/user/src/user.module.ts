import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { LocalKeyManager } from './adapters/local-key-manager.adapter.js';
import { KmsKeyManager } from './adapters/kms-key-manager.adapter.js';
import { MockKycAdapter } from './adapters/mock-kyc.adapter.js';
import { PiiVaultService } from './internal/pii-vault.service.js';
import { PRISMA } from './internal/tokens.js';
import { KEY_MANAGER } from './ports/key-manager.port.js';
import { KYC_PROVIDER } from './ports/kyc-provider.port.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

export interface UserModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Hex-encoded 32-byte KEK for the LocalKeyManager. Required when
   *  keyManager === 'local'. */
  localKekHex?: string;
  keyManager: 'local' | 'kms';
  kycProvider: 'mock' | 'alloy' | 'persona';
  isDevelopment: boolean;
}

@Module({})
export class UserModule {
  static forRoot(options: UserModuleOptions): DynamicModule {
    const prisma: Provider = {
      provide: PRISMA,
      useExisting: options.prismaToken as never,
    };

    const keyManager: Provider = {
      provide: KEY_MANAGER,
      useFactory: () => {
        if (options.keyManager === 'local') {
          // LocalKeyManager is dev-only; the production refusal lives
          // upstream in apps/api/src/config/env.ts so a misconfigured
          // production deploy refuses to boot rather than reaching this
          // factory with `keyManager='local'`. Defense-in-depth: the
          // factory below would still succeed in non-prod, but production
          // can never get here.
          if (!options.localKekHex) {
            throw new Error('UserModule: keyManager=local requires localKekHex');
          }
          return new LocalKeyManager(options.localKekHex);
        }
        if (options.keyManager === 'kms') {
          // STUB — see services/user/src/adapters/kms-key-manager.adapter.ts
          // docstring + docs/runbooks/kek-rotation.md. The dispatch path
          // is wired so a production boot with `KEY_MANAGER=kms` resolves
          // to a real class; the real AWS KMS client lands in a follow-up
          // infra task.
          return new KmsKeyManager();
        }
        // Exhaustiveness — TypeScript enum guarantees we never reach
        // here, but throwing keeps the boot loud on any future enum
        // widening that forgets to update this factory.
        throw new Error(`UserModule: unknown keyManager '${String(options.keyManager)}'`);
      },
    };

    const kyc: Provider = {
      provide: KYC_PROVIDER,
      useFactory: () => {
        if (options.kycProvider === 'mock') {
          if (!options.isDevelopment) {
            throw new Error(
              'MockKycAdapter is dev-only — wire Alloy/Persona/Socure for non-development.',
            );
          }
          return new MockKycAdapter();
        }
        throw new Error(`KYC adapter ${options.kycProvider} not yet implemented`);
      },
    };

    return {
      module: UserModule,
      // Global so PiiVaultService can be injected by services/merchant
      // (and any future regulated module) without each one re-importing
      // the user module's full configuration.
      global: true,
      controllers: [UserController],
      providers: [prisma, keyManager, kyc, PiiVaultService, UserService],
      exports: [UserService, PiiVaultService],
    };
  }
}
