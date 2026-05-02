import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { BadRequest } from '@eazepay/shared-utils';
import type {
  BankAccountExchangeInput,
  BankAccountExchangeResult,
  BankAccountProvider,
} from '../ports/bank-account-provider.port.js';

/**
 * DEV ONLY. Accepts any public token of the form `mock:<bankName>:<last4>`.
 * Token like `mock:Chase:0001` returns a deterministic provider token
 * (so retries collapse) plus the parsed last4 + bankName.
 *
 * Heuristic risk path: last4 ending in `99` returns signal='high' so the
 * NSF-risk path is reachable without further mocks.
 */
@Injectable()
export class MockBankAccountAdapter implements BankAccountProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockBankAccountAdapter.name);

  async exchange(input: BankAccountExchangeInput): Promise<BankAccountExchangeResult> {
    const m = /^mock:([^:]+):(\d{4})$/.exec(input.publicToken);
    if (!m) {
      throw BadRequest({
        code: 'invalid_public_token',
        detail: 'mock provider expects format mock:<bankName>:<last4>',
      });
    }
    const bankName = m[1]!;
    const last4 = m[2]!;
    const providerToken = `mock-bank-${createHash('sha256')
      .update(`${input.userId}:${input.publicToken}`)
      .digest('hex')
      .slice(0, 24)}`;
    const signal = last4.endsWith('99') ? 'high' : 'low';
    this.logger.warn(
      `[DEV-ONLY] mock bank exchange user=${input.userId} bank=${bankName} last4=${last4} signal=${signal}`,
    );
    return { providerToken, last4, bankName, signal };
  }
}
