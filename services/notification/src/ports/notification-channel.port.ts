import type { NotificationChannel as Channel } from '@prisma/client';

/**
 * Low-level delivery primitive. One adapter per (channel, provider)
 * tuple — Twilio for SMS, SES/SendGrid for email, APNs/FCM for push, an
 * in-process broadcaster for in_app. The dispatcher routes a Notification
 * to its channel + provider and calls send().
 */
export interface ChannelDeliverInput {
  notificationId: string;
  channel: Channel;
  /** Where to deliver — already resolved by the dispatcher. */
  to: string;
  title: string;
  body: string;
}

export interface ChannelDeliverResult {
  status: 'sent' | 'failed';
  providerRef?: string;
  failureReason?: string;
}

export interface NotificationChannelAdapter {
  readonly name: string;
  readonly channel: Channel;
  send(input: ChannelDeliverInput): Promise<ChannelDeliverResult>;
}

export const NOTIFICATION_CHANNEL_ADAPTERS = Symbol('NOTIFICATION_CHANNEL_ADAPTERS');
