// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEventStream } from './event-stream';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

/**
 * Regression spec for the partner-detail blank-page bug.
 *
 * Symptom: clicking a partner row at /control-panel triggered a
 * client-side navigation that froze the React renderer for 45+ seconds.
 * Root cause: when the SSE endpoint at NEXT_PUBLIC_API_URL was
 * unreachable (404 / CORS / DNS), the browser's EventSource fired
 * `error` rapidly — much faster than the documented 3s `retry:`. Each
 * error called `setReconnects(n => n + 1)`, which re-rendered every
 * ancestor including AppShell. During the heavy mount of the 1.8k-line
 * partner-detail page, this storm stalled reconciliation entirely.
 *
 * The fix: cap reconnect attempts to MAX_RECONNECTS (5). After the cap,
 * close the EventSource and stop retrying. The strip's "Reconnecting…"
 * pill stays visible so ops still sees the degraded state, but the
 * runtime stops paying for it.
 */

interface FakeEventSource {
  readonly url: string;
  readonly withCredentials: boolean;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  addEventListener: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  fireError: () => void;
}

const fakeEventSources: FakeEventSource[] = [];

class FakeEventSourceCtor {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  addEventListener = vi.fn();
  // Real EventSource stops firing events once close() is called. Match
  // that contract in the mock so the cap test isn't trivially defeated
  // by the mock continuing to dispatch after close().
  close = vi.fn(() => {
    this.onerror = null;
    this.onmessage = null;
  });
  readonly withCredentials: boolean;

  constructor(
    public readonly url: string,
    init?: { withCredentials?: boolean },
  ) {
    this.withCredentials = init?.withCredentials ?? false;
    const ref: FakeEventSource = this as unknown as FakeEventSource;
    (ref as { fireError: () => void }).fireError = () => this.onerror?.();
    fakeEventSources.push(ref);
  }
}

function HarnessHook({
  onState,
}: {
  onState: (s: { reconnects: number; connected: boolean }) => void;
}) {
  const s = useEventStream({ kind: 'master' });
  useEffect(() => {
    onState({ reconnects: s.reconnects, connected: s.connected });
  });
  return null;
}

function mountHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let state: { reconnects: number; connected: boolean } = { reconnects: 0, connected: false };
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(HarnessHook, { onState: (s) => (state = s) }));
  });
  return {
    getState: () => state,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('useEventStream — reconnect cap (regression: partner-detail freeze)', () => {
  beforeEach(() => {
    fakeEventSources.length = 0;
    vi.stubGlobal('EventSource', FakeEventSourceCtor);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('bumps the reconnects counter on each onerror up to the cap', () => {
    const h = mountHarness();
    try {
      expect(fakeEventSources).toHaveLength(1);
      const es = fakeEventSources[0]!;

      act(() => {
        es.fireError();
      });
      expect(h.getState().reconnects).toBe(1);

      act(() => {
        es.fireError();
        es.fireError();
      });
      expect(h.getState().reconnects).toBe(3);
    } finally {
      h.cleanup();
    }
  });

  it('closes the EventSource and stops counting after 5 reconnects', () => {
    const h = mountHarness();
    try {
      const es = fakeEventSources[0]!;
      act(() => {
        for (let i = 0; i < 7; i++) es.fireError();
      });
      expect(h.getState().reconnects).toBe(5);
      expect(es.close).toHaveBeenCalledTimes(1);
    } finally {
      h.cleanup();
    }
  });

  it('logs a warn line on the give-up event so ops sees it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const h = mountHarness();
    try {
      const es = fakeEventSources[0]!;
      act(() => {
        for (let i = 0; i < 5; i++) es.fireError();
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('giving up after 5 reconnect attempts'),
      );
    } finally {
      h.cleanup();
    }
  });

  it('does not freeze: 100 rapid errors complete within 200ms (no storm)', () => {
    const h = mountHarness();
    try {
      const es = fakeEventSources[0]!;
      const start = performance.now();
      act(() => {
        for (let i = 0; i < 100; i++) es.fireError();
      });
      const elapsed = performance.now() - start;

      // Before the cap, this loop would queue 100 setState calls per
      // error and could stall under realistic React trees. With the cap,
      // setReconnects is called at most 5 times. 200ms is loose — the
      // point is the loop completes promptly, not in 45s like the bug.
      expect(elapsed).toBeLessThan(200);
      expect(h.getState().reconnects).toBe(5);
      expect(es.close).toHaveBeenCalledTimes(1);
    } finally {
      h.cleanup();
    }
  });
});
