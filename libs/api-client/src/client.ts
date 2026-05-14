import type {
  ApplicationSnapshot,
  AuthChallenge,
  AuthTokens,
  NotificationItem,
  Offer,
  Problem,
  Repayment,
} from './types';

/**
 * Lightweight, framework-free HTTP client. Used by every frontend
 * (mobile, web, dashboards). Token storage + refresh flow are
 * delegated to a TokenStore the caller provides — it knows where to
 * persist (Keychain / KeyStore on mobile, secure cookie / IndexedDB
 * on web).
 */
export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  /** Optional device identifier; required by login + refresh. */
  deviceId: string;
  /** Optional fingerprint; passed as X-Device-Fingerprint on submit. */
  deviceFingerprint?: string;
  /** Hook fired when the API returns 401 after refresh fails. The host
   *  app routes the user back to login. */
  onAuthLost?: () => void;
}

export class ApiError extends Error {
  readonly problem: Problem;
  constructor(problem: Problem) {
    super(problem.title);
    this.problem = problem;
  }
}

const isProblem = (v: unknown): v is Problem =>
  typeof v === 'object' && v !== null && 'status' in v && 'code' in v;

export class EazePayApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  // ---- Auth ----
  register(input: {
    email?: string;
    phone?: string;
    password: string;
    marketingConsent?: boolean;
  }): Promise<{ userId: string; requiresVerification: 'email' | 'phone'; challenge: AuthChallenge }> {
    return this.request('POST', '/v1/auth/register', input, {
      idempotencyKey: cryptoRandomKey('reg'),
    });
  }

  async login(input: { identifier: string; password: string }): Promise<{
    mfaRequired: boolean;
    challenge?: AuthChallenge;
    tokens?: AuthTokens;
  }> {
    const r = await this.request<{
      mfaRequired: boolean;
      challenge?: AuthChallenge;
      tokens?: AuthTokens;
    }>('POST', '/v1/auth/login', { ...input, deviceId: this.opts.deviceId });
    if (r.tokens) await this.opts.tokenStore.setTokens(r.tokens);
    return r;
  }

  async verifyOtp(input: { challengeId: string; code: string }): Promise<{ tokens: AuthTokens }> {
    const r = await this.request<{ tokens: AuthTokens }>('POST', '/v1/auth/verify-otp', {
      ...input,
      deviceId: this.opts.deviceId,
    });
    await this.opts.tokenStore.setTokens(r.tokens);
    return r;
  }

  // ---- Me / profile ----
  me(): Promise<unknown> {
    return this.request('GET', '/v1/me');
  }

  // ---- Applications ----
  createApplication(input: {
    category: string;
    requestedAmountCents: string | number;
    termMonths: number;
    purposeDetail?: string;
    channel?: 'consumer_direct' | 'merchant_link' | 'merchant_widget';
    merchantId?: string;
  }): Promise<ApplicationSnapshot> {
    return this.request('POST', '/v1/applications', input, {
      idempotencyKey: cryptoRandomKey('app'),
    });
  }

  submitApplication(applicationId: string): Promise<ApplicationSnapshot> {
    return this.request('POST', `/v1/applications/${applicationId}/submit`, {}, {
      idempotencyKey: cryptoRandomKey('sub'),
    });
  }

  getApplication(applicationId: string): Promise<ApplicationSnapshot> {
    return this.request('GET', `/v1/applications/${applicationId}`);
  }

  listOffers(applicationId: string): Promise<Offer[]> {
    return this.request('GET', `/v1/applications/${applicationId}/offers`);
  }

  acceptOffer(applicationId: string, offerId: string): Promise<ApplicationSnapshot> {
    return this.request(
      'POST',
      `/v1/applications/${applicationId}/offers/${offerId}/accept`,
      {},
      { idempotencyKey: cryptoRandomKey('off') },
    );
  }

  // ---- Loans + repayments ----
  getLoan(loanId: string): Promise<unknown> {
    return this.request('GET', `/v1/loans/${loanId}`);
  }

  listRepayments(loanId: string): Promise<Repayment[]> {
    return this.request('GET', `/v1/loans/${loanId}/repayments`);
  }

  // ---- Notifications ----
  listNotifications(): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
    return this.request('GET', '/v1/me/notifications');
  }

  // ---- Internal ----
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: { idempotencyKey?: string; retryOn401?: boolean },
  ): Promise<T> {
    const access = await this.opts.tokenStore.getAccessToken();
    const url = `${this.opts.baseUrl}${path}`;
    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (access) headers['authorization'] = `Bearer ${access}`;
    if (init?.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;
    if (this.opts.deviceFingerprint) {
      headers['x-device-fingerprint'] = this.opts.deviceFingerprint;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;

    if (!res.ok) {
      // 401 → try one refresh + retry; if that fails, clear tokens + tell host app
      if (res.status === 401 && init?.retryOn401 !== false && access) {
        const refreshed = await this.tryRefresh();
        if (refreshed) return this.request(method, path, body, { ...init, retryOn401: false });
        await this.opts.tokenStore.clear();
        this.opts.onAuthLost?.();
      }
      const problem: Problem = isProblem(json)
        ? json
        : {
            type: 'about:blank',
            status: res.status,
            title: 'Request failed',
            code: 'request_failed',
          };
      throw new ApiError(problem);
    }
    return json as T;
  }

  private async tryRefresh(): Promise<boolean> {
    const refresh = await this.opts.tokenStore.getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${this.opts.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh, deviceId: this.opts.deviceId }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { tokens: AuthTokens };
      await this.opts.tokenStore.setTokens(data.tokens);
      return true;
    } catch {
      return false;
    }
  }
}

function cryptoRandomKey(prefix: string): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `${prefix}-${hex}`;
}
