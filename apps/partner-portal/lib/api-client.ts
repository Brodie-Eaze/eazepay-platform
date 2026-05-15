/**
 * Partner-portal API client — mirrors the Lovable platform's
 * `lib/api.ts` surface so every page can be ported by changing imports.
 *
 * `useApi().call(path, opts)`
 *   - prefixes every path with the Next.js BFF root (`/api/v1` → routes
 *     under apps/partner-portal/app/api proxy to the NestJS API at
 *     `${NEXT_PUBLIC_API_URL}/v1`)
 *   - sends cookies (`credentials: 'include'`) so the HttpOnly session
 *     cookie is lifted into the proxy
 *   - throws a typed Error on non-2xx so TanStack Query treats it as
 *     `isError`
 *
 * Formatting helpers (`formatCurrency`, `formatDate`, `statusBadge`)
 * are byte-identical to Lovable's so badge colours and date strings
 * match across both platforms.
 */

import { useCallback } from 'react';

/**
 * In dev we point the Next BFF at the local NestJS API on :3300.
 * In prod the BFF is the same origin, so this falls back to a relative
 * path and the browser never sees the API directly.
 */
const BFF_ROOT = process.env.NEXT_PUBLIC_BFF_ROOT ?? '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Read the CSRF cookie set by middleware. Returns null when absent
 * (e.g. on the very first page load before middleware has set it, or
 * in a non-browser execution context like Node-side data fetching).
 *
 * The cookie name is duplicated rather than imported from `lib/csrf.ts`
 * because that module pulls in `node:crypto` for the mint/verify
 * functions, and `node:crypto` is not available in the Edge runtime
 * (where some Next.js fetch helpers execute). Keeping the cookie name
 * inline keeps this helper Edge-compatible.
 */
function readCsrfCookieFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)eazepay_csrf=([^;]+)/);
  return match?.[1] ?? null;
}

/** Low-level fetch wrapper. Throws ApiError on non-2xx. */
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  // Echo the CSRF cookie into X-CSRF-Token on every non-GET request so
  // the BFF guards pass without each call site remembering. The cookie
  // is readable from JS by design (HttpOnly=false) — see lib/csrf.ts
  // for the threat model and the wrapped routes.
  const method = options?.method?.toUpperCase() ?? 'GET';
  const isStateChanging = method !== 'GET' && method !== 'HEAD';
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isStateChanging) {
    mergedHeaders['X-CSRF-Token'] = readCsrfCookieFromDocument() ?? '';
  }
  if (options?.headers) {
    // RequestInit.headers can be Headers | string[][] | Record<string, string>.
    // Normalise to a record via the Headers constructor so spread above
    // always yields concrete string values.
    const incoming = new Headers(options.headers);
    incoming.forEach((value, key) => {
      mergedHeaders[key] = value;
    });
  }

  const res = await fetch(`${BFF_ROOT}${path}`, {
    credentials: 'include',
    ...options,
    headers: mergedHeaders,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.detail ?? body?.title ?? `HTTP ${res.status}`,
      res.status,
      body?.code ?? null,
    );
  }

  // 204 No Content has empty body
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Hook returning an authenticated API caller bound to the current
 * session. Identical surface to Lovable so existing pages can be
 * imported with `import { useApi } from '@/lib/api-client'`.
 */
export function useApi() {
  const call = useCallback(async <T>(path: string, options?: RequestInit): Promise<T> => {
    return apiRequest<T>(path, options);
  }, []);
  return { call };
}

// ───── Formatting helpers (byte-identical to Lovable) ─────

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Tailwind utility classes for status badges. The colour mapping
 * matches Lovable's so the same lifecycle statuses paint the same
 * everywhere. Add new statuses here, not at call sites.
 */
export function statusBadge(status: string): string {
  /**
   * Mono palette only — depth (dark navy / mid grey / light grey)
   * conveys state, not hue. Three weights:
   *   - SOLID: terminal-positive states (paid / reconciled / funded /
   *     completed) → solid navy badge with white text. Highest visual
   *     weight.
   *   - OUTLINE: in-flight states (pending / running / submitted /
   *     calculating) → light grey wash with dark navy text + thin
   *     border. Mid visual weight.
   *   - SOFT: terminal-archived (cancelled / disabled / closed) → very
   *     muted grey, lowest visual weight.
   */
  const SOLID = 'bg-bg-inverse text-white';
  const OUTLINE = 'bg-bg-muted text-fg border border-border';
  const SOFT = 'bg-bg-muted text-fg-muted border border-border';

  const map: Record<string, string> = {
    // Terminal-positive (solid navy)
    ACTIVE: SOLID,
    SUCCEEDED: SOLID,
    COMPLETED: SOLID,
    FUNDED: SOLID,
    APPROVED: SOLID,
    RECONCILED: SOLID,
    PAID: SOLID,
    // In-flight (outline)
    RUNNING: OUTLINE,
    PENDING: OUTLINE,
    SUBMITTED: OUTLINE,
    SOFT_PULL_COMPLETED: OUTLINE,
    ROUTED: OUTLINE,
    ONBOARDING: OUTLINE,
    KYB_IN_PROGRESS: OUTLINE,
    CALCULATING: OUTLINE,
    RECONCILING: OUTLINE,
    // Negative (soft — still mono, weight via italic/font in callers if needed)
    FAILED: SOFT,
    SUSPENDED: SOFT,
    DENIED: SOFT,
    DECLINED: SOFT,
    EXCEPTION: SOFT,
    REJECTED: SOFT,
    // Rollback / partial
    ROLLING_BACK: SOFT,
    LATE: SOFT,
    // Terminal-archived
    CHURNED: SOFT,
    DISABLED: SOFT,
    INACTIVE: SOFT,
    CLOSED: SOFT,
    CANCELLED: SOFT,
    EXPIRED: SOFT,
  };
  return map[status.toUpperCase()] ?? SOFT;
}
