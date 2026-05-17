/**
 * Server-Sent Events writer — frames JSON events as `id:`/`event:`/
 * `data:` per the SSE spec so EventSource on the client picks them up
 * cleanly + supports Last-Event-ID reconnection.
 *
 * We don't depend on a framework SSE helper because Fastify (the
 * platform under NestJS in this repo, see apps/api main.ts) needs
 * the raw socket; this keeps the writer portable.
 */
import type { ServerResponse } from 'node:http';
import type { PublishedEvent } from '../events.types.js';

export interface SseClient {
  send: (event: PublishedEvent) => void;
  comment: (text: string) => void;
  close: () => void;
}

export interface SseStartOpts {
  /** Disable response buffering at proxies (nginx, cloudflare, railway-edge). */
  disableBuffering?: boolean;
}

export function startSse(res: ServerResponse, opts: SseStartOpts = {}): SseClient {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Anti-buffering for proxies + Cloudflare.
  if (opts.disableBuffering) res.setHeader('X-Accel-Buffering', 'no');
  // CORS: SSE is same-origin in our deploy (partner-portal proxies via
  // Next.js rewrites), so no extra ACAO is needed. If a future client
  // is cross-origin, set ACAO + ACA-Credentials here.

  // Initial retry hint — browsers respect this for the auto-reconnect
  // backoff. 3s feels right for a live ticker.
  res.write('retry: 3000\n\n');

  let closed = false;
  const safeWrite = (chunk: string) => {
    if (closed) return;
    try {
      res.write(chunk);
    } catch {
      closed = true;
    }
  };

  return {
    send(event) {
      // `id` MUST be a single line per the spec, no embedded newlines.
      safeWrite(`id: ${event.id}\n`);
      safeWrite(`event: ${event.kind}\n`);
      const data = JSON.stringify(event);
      // Multi-line data lines if the payload ever contained newlines
      // (shouldn't, after sanitiser, but defence in depth).
      for (const line of data.split('\n')) {
        safeWrite(`data: ${line}\n`);
      }
      safeWrite('\n');
    },
    comment(text) {
      safeWrite(`: ${text}\n\n`);
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        res.end();
      } catch {
        /* ignore */
      }
    },
  };
}
