import { Injectable, Logger } from '@nestjs/common';
import type {
  DebitInput,
  DisburseInput,
  PaymentProvider,
  ProviderResult,
} from '../ports/payment-provider.port.js';

/**
 * DEV ONLY. Always succeeds synchronously. Generates a deterministic
 * provider ref from the idempotencyKey so retries collapse to the same
 * Transaction row.
 *
 * Heuristic failure path for testing: any amountCents ending in 0001
 * deterministically returns `failed` with reasonCode='mock_force_fail'
 * so the unhappy path is reachable without provider mocks.
 */
@Injectable()
export class MockPaymentAdapter implements PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentAdapter.name);

  async disburse(input: DisburseInput): Promise<ProviderResult> {
    if (this.shouldFail(input.amountCents)) {
      this.logger.warn(`[DEV-ONLY] mock disburse FORCED FAIL key=${input.idempotencyKey}`);
      return {
        status: 'failed',
        providerRef: `mock-${input.idempotencyKey}`,
        reasonCode: 'mock_force_fail',
      };
    }
    this.logger.warn(
      `[DEV-ONLY] mock disburse $${(Number(input.amountCents) / 100).toFixed(2)} loan=${input.loanId} key=${input.idempotencyKey}`,
    );
    return {
      status: 'succeeded',
      providerRef: `mock-${input.idempotencyKey}`,
      settledAt: new Date().toISOString(),
    };
  }

  async debit(input: DebitInput): Promise<ProviderResult> {
    if (this.shouldFail(input.amountCents)) {
      return {
        status: 'failed',
        providerRef: `mock-${input.idempotencyKey}`,
        reasonCode: 'mock_force_fail',
      };
    }
    return {
      status: 'succeeded',
      providerRef: `mock-${input.idempotencyKey}`,
      settledAt: new Date().toISOString(),
    };
  }

  private shouldFail(amountCents: bigint): boolean {
    return amountCents % 10_000n === 1n;
  }
}
