import { Injectable, Logger } from '@nestjs/common';
import type { ContractedHook } from '@eazepay/service-application';
import { PaymentService } from '@eazepay/service-payment';

/**
 * Bridges the application service's ContractedHook port to the payment
 * service's disbursement entry point. Lives in apps/api so neither
 * service depends on the other.
 *
 * Errors are logged but never thrown back into the application
 * lifecycle — disbursement failures roll application status back to
 * `contracted` inside PaymentService for retry, and the audit log
 * captures the failure separately.
 */
@Injectable()
export class PaymentContractedHookAdapter implements ContractedHook {
  private readonly logger = new Logger(PaymentContractedHookAdapter.name);

  constructor(private readonly payments: PaymentService) {}

  async onContracted(args: { applicationId: string; loanId: string }): Promise<void> {
    try {
      await this.payments.disburseAndSchedule(args.loanId);
    } catch (err) {
      this.logger.error({ err, ...args }, 'disbursement failed in contracted hook');
    }
  }
}
