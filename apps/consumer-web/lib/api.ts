'use client';

import { EazePayApiClient, type AuthTokens, type TokenStore } from '@eazepay/api-client';

/**
 * Browser-side API client. Tokens stored in sessionStorage for the
 * MVP (avoids localStorage XSS surface for a fintech product).
 * Production: switch to httpOnly + SameSite=Lax cookies set by a
 * thin Next.js BFF route, so JS never sees raw tokens.
 */
const ACCESS = 'eazepay.access';
const REFRESH = 'eazepay.refresh';
const DEVICE = 'eazepay.device';

const tokenStore: TokenStore = {
  async getAccessToken() {
    return typeof window === 'undefined' ? null : sessionStorage.getItem(ACCESS);
  },
  async getRefreshToken() {
    return typeof window === 'undefined' ? null : sessionStorage.getItem(REFRESH);
  },
  async setTokens(t: AuthTokens) {
    sessionStorage.setItem(ACCESS, t.accessToken);
    sessionStorage.setItem(REFRESH, t.refreshToken);
  },
  async clear() {
    sessionStorage.removeItem(ACCESS);
    sessionStorage.removeItem(REFRESH);
  },
};

function deviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem(DEVICE);
  if (!id) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    sessionStorage.setItem(DEVICE, id);
  }
  return id;
}

let _client: EazePayApiClient | null = null;
export function api(): EazePayApiClient {
  if (_client) return _client;
  _client = new EazePayApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
    tokenStore,
    deviceId: deviceId(),
    onAuthLost: () => {
      if (typeof window !== 'undefined') window.location.href = '/sign-in';
    },
  });
  return _client;
}
