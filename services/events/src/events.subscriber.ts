import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { EVENT_CHANNEL, REDIS_SUB } from './internal/tokens.js';
import type { PublishedEvent } from './events.types.js';

type Listener = (event: PublishedEvent) => void;

/**
 * EventsSubscriber — single per-process Redis pub/sub subscription
 * that the SSE controllers register listeners against.
 *
 * Architecture:
 *   - ONE Redis SUB connection per replica (not per SSE client).
 *     Redis ioredis enters subscriber mode on first .subscribe call;
 *     that connection can only do pub/sub commands after that, which
 *     is why we have a dedicated sub client separate from the pub
 *     client (REDIS_PUB).
 *   - Listeners are stored in a Set; each SSE controller registers
 *     on stream open and removes on close. The hot loop is O(N
 *     listeners per event) which is fine up to a few thousand
 *     concurrent connections; horizontal scaling adds replicas.
 *   - Filter logic (admin vs partner scope) lives in the listener,
 *     not here — the subscriber broadcasts every event and the
 *     controller decides what to forward to its client.
 */
@Injectable()
export class EventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(EventsSubscriber.name);
  private readonly listeners = new Set<Listener>();

  constructor(
    @Inject(REDIS_SUB) private readonly sub: Redis,
    @Inject(EVENT_CHANNEL) private readonly channel: string,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.sub.subscribe(this.channel);
    this.sub.on('message', (chan: string, raw: string) => {
      if (chan !== this.channel) return;
      let event: PublishedEvent;
      try {
        event = JSON.parse(raw) as PublishedEvent;
      } catch (e) {
        this.log.warn(`malformed event JSON on ${chan}`, e instanceof Error ? e.stack : e);
        return;
      }
      // Listeners must not throw — defensive copy + each-in-try
      for (const fn of this.listeners) {
        try {
          fn(event);
        } catch (e) {
          this.log.warn(`listener threw on event ${event.uuid}`, e instanceof Error ? e.stack : e);
        }
      }
    });
    this.log.log(`subscribed to ${this.channel}`);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.sub.unsubscribe(this.channel);
    } catch {
      /* ignore on shutdown */
    }
  }

  /** Register a listener; returns an unsubscribe function. */
  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Visible for tests + ops health checks. */
  listenerCount(): number {
    return this.listeners.size;
  }
}
