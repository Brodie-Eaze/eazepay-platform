import { describe, expect, it } from 'vitest';
import {
  ConsoleEmailAdapter,
  ConsolePushAdapter,
  ConsoleSmsAdapter,
  InAppChannelAdapter,
} from '../src/adapters/console-channel.adapter.js';

describe('Console channel adapters — characterisation', () => {
  const send = (a: { send: (i: never) => Promise<unknown> }) =>
    a.send({
      notificationId: 'n-1',
      channel: 'in_app',
      to: 'someone@example.com',
      title: 'Hi',
      body: 'Body',
    } as never);

  it('email adapter binds channel="email" and emits provider ref prefixed with console-', async () => {
    const a = new ConsoleEmailAdapter();
    expect(a.channel).toBe('email');
    expect(await send(a)).toEqual({ status: 'sent', providerRef: 'console-n-1' });
  });

  it('sms adapter binds channel="sms"', async () => {
    const a = new ConsoleSmsAdapter();
    expect(a.channel).toBe('sms');
    expect(await send(a)).toMatchObject({ status: 'sent' });
  });

  it('push adapter binds channel="push"', async () => {
    const a = new ConsolePushAdapter();
    expect(a.channel).toBe('push');
    expect(await send(a)).toMatchObject({ status: 'sent' });
  });

  it('in_app adapter is a no-op with stable in_app- providerRef', async () => {
    const a = new InAppChannelAdapter();
    expect(a.channel).toBe('in_app');
    const r = await a.send({
      notificationId: 'n-99',
      channel: 'in_app',
      to: '',
      title: 't',
      body: 'b',
    });
    expect(r).toEqual({ status: 'sent', providerRef: 'in_app-n-99' });
  });
});
