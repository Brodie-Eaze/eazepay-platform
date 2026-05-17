import { Module, type DynamicModule, Logger, type Type } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BrandedEmailService } from './branded-email.service.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.port.js';
import { MockEmailAdapter } from './adapters/mock-email.adapter.js';
import { ResendEmailAdapter } from './adapters/resend-email.adapter.js';
import {
  EMAIL_DISPATCH_AUDIT,
  EmailDispatchAuditService,
  type EmailDispatchAuditWriter,
} from './email-dispatch-audit.service.js';
import { PrismaEmailDispatchAudit } from './adapters/prisma-email-dispatch-audit.adapter.js';

/**
 * Host-app integration:
 *
 *   EmailModule.forRoot({ prismaToken: PrismaService })
 *
 * Wiring:
 *   - Provider: RESEND_API_KEY env present → ResendEmailAdapter,
 *               else MockEmailAdapter.
 *   - Audit writer: when `prismaToken` is supplied, wires the
 *               PrismaEmailDispatchAudit adapter so every send lands
 *               in the email_dispatch table for SOC2 evidence. When
 *               absent (unit tests), the console writer is used.
 *
 * The host module MUST already provide `prismaToken` (apps/api wires
 * PrismaService); EmailModule injects it into the audit-writer
 * factory.
 */
export interface EmailModuleOptions {
  /** Nest DI token that resolves to a PrismaClient. When omitted the
   *  audit writer falls back to the console (dev only). */
  prismaToken?: Type<PrismaClient> | symbol;
  /** Test override — supply a pre-constructed writer to short-circuit
   *  the factory. Production never sets this. */
  auditWriter?: EmailDispatchAuditWriter;
}

@Module({})
export class EmailModule {
  static forRoot(options: EmailModuleOptions = {}): DynamicModule {
    const logger = new Logger('EmailModule');
    const useResend = Boolean(process.env.RESEND_API_KEY);

    if (!useResend && process.env.NODE_ENV === 'production') {
      logger.warn(
        'RESEND_API_KEY is unset in production — EmailModule will use the MockEmailAdapter ' +
          '(no outbound mail). Set RESEND_API_KEY on the deployment to enable real sends.',
      );
    }

    const providerProvider = {
      provide: EMAIL_PROVIDER,
      useClass: useResend ? ResendEmailAdapter : MockEmailAdapter,
    };

    const auditProvider = options.auditWriter
      ? { provide: EMAIL_DISPATCH_AUDIT, useValue: options.auditWriter }
      : options.prismaToken
        ? {
            provide: EMAIL_DISPATCH_AUDIT,
            useFactory: (prisma: PrismaClient) => new PrismaEmailDispatchAudit(prisma),
            inject: [options.prismaToken],
          }
        : { provide: EMAIL_DISPATCH_AUDIT, useValue: new EmailDispatchAuditService() };

    return {
      module: EmailModule,
      providers: [providerProvider, auditProvider, BrandedEmailService],
      exports: [BrandedEmailService],
    };
  }
}

export type { EmailProvider };
