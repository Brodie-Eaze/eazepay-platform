import { Injectable, Logger } from '@nestjs/common';
import type {
  DeviceRiskInput,
  DeviceRiskProvider,
  DeviceRiskResult,
} from '../ports/device-risk.port.js';

/**
 * DEV ONLY. Heuristic outcome for testing (order matters — most-specific first):
 *  - deviceFingerprint starts with 'risky-' → score 90 + reason codes
 *  - User-Agent matches a known bot pattern (curl/wget/python-requests/headless
 *    chrome/PhantomJS/bot/spider/crawler) → score 75. This fires even when no
 *    fingerprint or IP is supplied — automated traffic is a signal on its own.
 *  - any other deviceFingerprint or ipAddress present → score 5 (low)
 *  - missing fingerprint AND IP AND no bot UA → score null (no signal)
 */
@Injectable()
export class MockDeviceRiskAdapter implements DeviceRiskProvider {
  readonly name = 'mock-device';
  private readonly logger = new Logger(MockDeviceRiskAdapter.name);

  // Known automated / non-browser user-agents. Tested case-insensitively.
  private static readonly BOT_UA_PATTERN =
    /curl|wget|python-requests|libwww|httpie|go-http-client|java\/|okhttp|headlesschrome|phantomjs|slimerjs|bot|spider|crawler/i;

  async evaluate(input: DeviceRiskInput): Promise<DeviceRiskResult> {
    const fp = input.deviceFingerprint ?? '';
    const ua = input.userAgent ?? '';
    const ip = input.ipAddress ?? '';

    if (fp.startsWith('risky-')) {
      return { score: 90, reasonCodes: ['mock_risky_device_fingerprint'] };
    }
    if (ua && MockDeviceRiskAdapter.BOT_UA_PATTERN.test(ua)) {
      return { score: 75, reasonCodes: ['mock_automated_user_agent'] };
    }
    if (!fp && !ip) {
      return { score: null, reasonCodes: ['mock_no_signal'] };
    }
    return { score: 5, reasonCodes: [] };
  }
}
