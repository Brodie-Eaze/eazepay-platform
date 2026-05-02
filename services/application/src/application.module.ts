import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ApplicationController } from './application.controller.js';
import { ApplicationService } from './application.service.js';
import { PRISMA } from './internal/tokens.js';
import { POST_SUBMIT_HOOK, type PostSubmitHook } from './ports/post-submit.port.js';
import { ESIGN_PROVIDER } from './ports/esign-provider.port.js';
import { MockESignAdapter } from './adapters/mock-esign.adapter.js';

export interface ApplicationModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Token resolving to a PostSubmitHook implementation. Default: no-op. */
  postSubmitHookToken?: symbol | string | (abstract new (...args: never[]) => PostSubmitHook);
  /** E-sign provider. 'mock' is dev only; real adapters land later. */
  esignProvider: 'mock' | 'docusign' | 'dropbox_sign';
  isDevelopment: boolean;
}

class NoopPostSubmitHook implements PostSubmitHook {
  async onSubmitted(): Promise<void> {
    /* default: do nothing — service is independently runnable in tests */
  }
}

@Module({})
export class ApplicationModule {
  static forRoot(options: ApplicationModuleOptions): DynamicModule {
    const prisma: Provider = {
      provide: PRISMA,
      useExisting: options.prismaToken as never,
    };
    const hook: Provider = options.postSubmitHookToken
      ? { provide: POST_SUBMIT_HOOK, useExisting: options.postSubmitHookToken as never }
      : { provide: POST_SUBMIT_HOOK, useClass: NoopPostSubmitHook };

    const esign: Provider = {
      provide: ESIGN_PROVIDER,
      useFactory: () => {
        if (options.esignProvider === 'mock') {
          if (!options.isDevelopment) {
            throw new Error(
              'MockESignAdapter is dev-only — wire DocuSign/Dropbox Sign for non-development.',
            );
          }
          return new MockESignAdapter();
        }
        throw new Error(`E-sign provider ${options.esignProvider} not yet implemented`);
      },
    };

    return {
      module: ApplicationModule,
      controllers: [ApplicationController],
      providers: [prisma, hook, esign, ApplicationService],
      exports: [ApplicationService],
    };
  }
}
