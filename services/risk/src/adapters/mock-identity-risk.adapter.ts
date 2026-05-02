import { Injectable } from '@nestjs/common';
import type {
  IdentityRiskInput,
  IdentityRiskProvider,
  IdentityRiskResult,
} from '../ports/identity-risk.port.js';

/**
 * DEV ONLY. Heuristic email/phone risk for tests:
 *  - email contains '+test+risky' → emailScore 90
 *  - email domain in disposable list → emailScore 70
 *  - phone starts with +1555 (test prefix) → phoneScore 70
 *  - else → low (10)
 */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.io',
]);

@Injectable()
export class MockIdentityRiskAdapter implements IdentityRiskProvider {
  readonly name = 'mock-identity';

  async evaluate(input: IdentityRiskInput): Promise<IdentityRiskResult> {
    const reasonCodes: string[] = [];
    let emailScore: number | null = null;
    let phoneScore: number | null = null;

    if (input.email) {
      if (input.email.includes('+test+risky')) {
        emailScore = 90;
        reasonCodes.push('mock_email_test_risky');
      } else {
        const domain = input.email.split('@')[1]?.toLowerCase();
        if (domain && DISPOSABLE_DOMAINS.has(domain)) {
          emailScore = 70;
          reasonCodes.push('mock_email_disposable_domain');
        } else {
          emailScore = 10;
        }
      }
    }
    if (input.phone) {
      if (input.phone.startsWith('+1555')) {
        phoneScore = 70;
        reasonCodes.push('mock_phone_test_prefix');
      } else {
        phoneScore = 10;
      }
    }
    return { emailScore, phoneScore, reasonCodes };
  }
}
