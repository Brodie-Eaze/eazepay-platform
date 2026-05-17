import { setup } from 'xstate';
import type { ApplicationEvent, ApplicationStatus } from './application.types.js';

/**
 * Application lifecycle. The machine validates transitions; the service
 * persists state changes to Postgres + writes audit rows. Side effects
 * (lender orchestration, notifications, decisioning) are owned by the
 * service so the machine stays a pure transition graph that's easy to
 * reason about and test.
 *
 *   draft ─SUBMIT─► submitted ─BEGIN_UNDERWRITING─► underwriting
 *     │                                                │
 *     │                              ┌─PRESENT_OFFERS──┤
 *     │                              ▼                 │
 *     │                       offers_presented         │
 *     │                              │                 │
 *     │                       ACCEPT_OFFER             │
 *     │                              ▼                 │
 *     │                          accepted              │
 *     │                              │                 │
 *     │                       CONTRACT_SIGNED          │
 *     │                              ▼                 │
 *     │                         contracted             │
 *     │                              │                 │
 *     │                            FUND                │
 *     │                              ▼                 │
 *     │                          funding               │
 *     │                              │                 │
 *     │                          ACTIVATE              │
 *     │                              ▼                 │
 *     │                           active               │
 *     │                                                │
 *     ├──────────CANCEL──────────► cancelled (terminal from any non-active)
 *     ├──────────EXPIRE──────────► expired   (terminal from non-active)
 *     └──────────DECLINE─────────► declined  (terminal from underwriting / presented)
 */
export const applicationMachine = setup({
  types: {
    events: {} as ApplicationEvent,
  },
}).createMachine({
  id: 'application',
  initial: 'draft',
  states: {
    draft: {
      on: {
        SUBMIT: 'submitted',
        CANCEL: 'cancelled',
      },
    },
    submitted: {
      on: {
        BEGIN_UNDERWRITING: 'underwriting',
        DECLINE: 'declined',
        CANCEL: 'cancelled',
        EXPIRE: 'expired',
      },
    },
    underwriting: {
      on: {
        PRESENT_OFFERS: 'offers_presented',
        DECLINE: 'declined',
        CANCEL: 'cancelled',
        EXPIRE: 'expired',
      },
    },
    offers_presented: {
      on: {
        ACCEPT_OFFER: 'accepted',
        DECLINE: 'declined',
        CANCEL: 'cancelled',
        EXPIRE: 'expired',
      },
    },
    accepted: {
      on: {
        CONTRACT_SIGNED: 'contracted',
        CANCEL: 'cancelled',
        EXPIRE: 'expired',
      },
    },
    contracted: {
      on: {
        FUND: 'funding',
        CANCEL: 'cancelled',
      },
    },
    funding: {
      on: {
        ACTIVATE: 'active',
      },
    },
    active: { type: 'final' },
    declined: { type: 'final' },
    cancelled: { type: 'final' },
    expired: { type: 'final' },
  },
});

/**
 * Pure transition validator. Returns the next status if the transition is
 * legal under the machine, or null otherwise. Used by the service to
 * guard persistence: invalid transitions are rejected before any DB write.
 */
export const applyTransition = (
  current: ApplicationStatus,
  event: ApplicationEvent,
): ApplicationStatus | null => {
  const node = applicationMachine.config.states?.[current];
  if (!node || typeof node !== 'object') return null;
  const handlers = (node as { on?: Record<string, { target?: string } | string> }).on;
  if (!handlers) return null;
  const handler = handlers[event.type];
  if (!handler) return null;
  const target = typeof handler === 'string' ? handler : handler.target;
  return (target as ApplicationStatus | undefined) ?? null;
};

export const isTerminalStatus = (status: ApplicationStatus): boolean =>
  status === 'active' || status === 'declined' || status === 'cancelled' || status === 'expired';
