import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ApplicationController } from './application.controller.js';
import { ApplicationService } from './application.service.js';
import { PRISMA } from './internal/tokens.js';
import { POST_SUBMIT_HOOK, type PostSubmitHook } from './ports/post-submit.port.js';

export interface ApplicationModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Token resolving to a PostSubmitHook implementation. Default: no-op. */
  postSubmitHookToken?: symbol | string | (abstract new (...args: never[]) => PostSubmitHook);
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
    return {
      module: ApplicationModule,
      controllers: [ApplicationController],
      providers: [prisma, hook, ApplicationService],
      exports: [ApplicationService],
    };
  }
}
