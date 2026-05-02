import { Injectable, Logger } from '@nestjs/common';
import type {
  DeviceRiskInput,
  DeviceRiskProvider,
  DeviceRiskResult,
} from '../ports/device-risk.port.js';

/**
 * DEV ONLY. Heuristic outcome for testing:
 *  - deviceFingerprint starts with 'risky-' → score 90 + reason codes
 *  - User-Agent contains 'curl' or 'bot' → score 75
 *  - else → score 5 (low)
 *  - missing fingerprint AND IP → score null (no signal)
 */
@Injectable()
export class MockDeviceRiskAdapter implements DeviceRiskProvider {
  readonly name = 'mock-device';
  private readonly logger = new Logger(MockDeviceRiskAdapter.name);

  async evaluate(input: DeviceRiskInput): Promise<DeviceRiskResult> {
    if (!input.deviceFingerprint && !input.ipAddress) {
      return { score: null, reasonCodes: ['mock_no_signal'] };
    }
    const fp = input.deviceFingerprint ?? '';
    const ua = input.userAgent ?? '';
    if (fp.startsWith('risky-')) {
      return { score: 90, reasonCodes: ['mock_risky_device_fingerprint'] };
    }
    if (/curl|bot|spider/i.test(ua)) {
      return { score: 75, reasonCodes: ['mock_automated_user_agent'] };
    }
    return { score: 5, reasonCodes: [] };
  }
}
