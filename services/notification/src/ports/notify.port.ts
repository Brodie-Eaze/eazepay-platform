import type { NotificationChannel as Channel } from '@prisma/client';

/**
 * NotifyPort — the high-level entry point that emitting services use.
 * Hides templates, channel routing, and delivery from callers.
 *
 * Other services depend on this interface (not on NotificationService
 * directly). The default implementation in apps/api wires
 * NotificationService; tests can wire a noop.
 */
export interface NotifyInput {
  userId: string;
  templateKey: string;
  payload?: Record<string, unknown>;
  /** Optional override of which channels to attempt; defaults to the
   *  template's configured channel list. */
  channels?: Channel[];
  /** Anchor entity for dedupe + audit, e.g. ('Application', applicationId). */
  subjectType?: string;
  subjectId?: string;
}

export interface NotifyPort {
  notify(input: NotifyInput): Promise<void>;
}

export const NOTIFY_PORT = Symbol('NOTIFY_PORT');
