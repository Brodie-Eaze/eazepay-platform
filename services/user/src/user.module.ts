import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { KMSClient } from '@aws-sdk/client-kms';
import type { PrismaClient } from '@prisma/client';
import { AwsKmsKeyManager } from './adapters/aws-kms-key-manager.adapter.js';
import { LocalKeyManager } from './adapters/local-key-manager.adapter.js';
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
  /** KMS key ARN or alias for AwsKmsKeyManager. Required when
   *  keyManager === 'aws-kms'. */
  kmsKeyId?: string;
  /** AWS region override for the KMS client. Falls back to the SDK
   *  default credential chain / `AWS_REGION` when omitted. */
  kmsRegion?: string;
  /** `local` for dev (KEK from env), `aws-kms` for the production
   *  AWS KMS path. `kms` kept as a back-compat alias for `aws-kms`. */
  keyManager: 'local' | 'kms' | 'aws-kms';
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
          if (!options.localKekHex) {
            throw new Error('UserModule: keyManager=local requires localKekHex');
          }
          return new LocalKeyManager(options.localKekHex);
        }
        if (options.keyManager === 'aws-kms' || options.keyManager === 'kms') {
          // Resolve the KMS key id lazily so dev/test boots that never
          // select this path don't need the AWS env present (per the
          // module-load safety rule in PR #170's audit comments).
          const keyId = options.kmsKeyId ?? process.env.KMS_KEK_KEY_ID;
          if (!keyId) {
            throw new Error(
              'UserModule: keyManager=aws-kms requires kmsKeyId option or KMS_KEK_KEY_ID env (full KMS key ARN or alias).',
            );
          }
          const client = new KMSClient({
            ...(options.kmsRegion ? { region: options.kmsRegion } : {}),
          });
          return new AwsKmsKeyManager({ keyId, client });
        }
        // Exhaustiveness: any future literal added to the union must
        // be handled above. The cast lets the compiler still flag a
        // missing branch via the unreachable assignment.
        const _exhaustive: never = options.keyManager;
        throw new Error(`UserModule: unsupported keyManager=${String(_exhaustive)}`);
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
