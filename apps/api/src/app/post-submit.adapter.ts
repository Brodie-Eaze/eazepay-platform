import { Injectable } from '@nestjs/common';
import type { PostSubmitHook } from '@eazepay/service-application';
import { OrchestrationService } from '@eazepay/service-orchestration';

/**
 * Bridges the application service's PostSubmitHook port to the
 * orchestration service. Lives in apps/api so neither service knows
 * about the other — both depend on apps/api wiring instead.
 */
@Injectable()
export class OrchestrationPostSubmitAdapter implements PostSubmitHook {
  constructor(private readonly orchestration: OrchestrationService) {}

  async onSubmitted(applicationId: string): Promise<void> {
    await this.orchestration.evaluate(applicationId);
  }
}
