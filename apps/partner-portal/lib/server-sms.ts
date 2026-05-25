/**
 * Optional Twilio SMS sender. Same graceful-degradation pattern as
 * `lib/realtime.ts` — no-op when env vars aren't set, no-op when the
 * twilio package isn't installed.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER     (E.164, e.g. +15558675309)
 *
 * Usage:
 *   await sendOutcomeSMS({ to: '+15551234567', body: 'Sarah M funded $14.2k.' });
 *
 * The function returns `{ provider: 'twilio', sid }` on real send,
 * `{ provider: 'mock' }` when the env vars are absent or twilio fails
 * to load. Failures during send log + return mock — they never throw
 * out to the caller, so the webhook handler can never 500 because of
 * an SMS hiccup.
 */

export type SmsResult = { provider: 'twilio'; sid: string } | { provider: 'mock'; reason: string };

type TwilioClient = {
  messages: {
    create: (opts: { from: string; to: string; body: string }) => Promise<{ sid: string }>;
  };
};

let cached: TwilioClient | null | undefined;
let envWarned = false;

async function loadClient(): Promise<TwilioClient | null> {
  if (cached !== undefined) return cached;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    if (!envWarned) {
      envWarned = true;

      console.info(
        '[sms] Twilio env vars unset (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER) — SMS sends are mocked. Wire Twilio to enable.',
      );
    }
    cached = null;
    return null;
  }
  try {
    const mod = await import('twilio');
    const twilio = mod.default as unknown as (sid: string, token: string) => TwilioClient;
    cached = twilio(sid, token);
    return cached;
  } catch (err) {
    console.warn('[sms] twilio package not installed — SMS sends are mocked:', err);
    cached = null;
    return null;
  }
}

export async function sendOutcomeSMS(input: { to: string; body: string }): Promise<SmsResult> {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) return { provider: 'mock', reason: 'TWILIO_FROM_NUMBER unset' };
  const client = await loadClient();
  if (!client) return { provider: 'mock', reason: 'twilio not configured' };
  try {
    const msg = await client.messages.create({
      from,
      to: input.to,
      body: input.body.slice(0, 320), // keep within 2 SMS segments
    });
    return { provider: 'twilio', sid: msg.sid };
  } catch (err) {
    console.warn('[sms] Twilio send failed:', err);
    return { provider: 'mock', reason: 'send_failed' };
  }
}
