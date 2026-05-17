import * as SecureStore from 'expo-secure-store';
import { EazePayApiClient, type AuthTokens, type TokenStore } from '@eazepay/api-client';
import Constants from 'expo-constants';

/**
 * Secure-Enclave-backed token storage. SecureStore on iOS is the
 * Keychain; on Android it's EncryptedSharedPreferences keyed by
 * AndroidKeyStore. ID token + refresh token live ONLY here — never
 * AsyncStorage, never the Redux/Zustand store.
 */
const ACCESS_KEY = 'eazepay.access';
const REFRESH_KEY = 'eazepay.refresh';
const ACCESS_EXP_KEY = 'eazepay.access.exp';
const REFRESH_EXP_KEY = 'eazepay.refresh.exp';
const DEVICE_ID_KEY = 'eazepay.device.id';

const tokenStore: TokenStore = {
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setTokens(tokens: AuthTokens) {
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
    await SecureStore.setItemAsync(ACCESS_EXP_KEY, tokens.accessTokenExpiresAt);
    await SecureStore.setItemAsync(REFRESH_EXP_KEY, tokens.refreshTokenExpiresAt);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(ACCESS_EXP_KEY);
    await SecureStore.deleteItemAsync(REFRESH_EXP_KEY);
  },
};

async function ensureDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined') crypto.getRandomValues(bytes);
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    id = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function buildApiClient(): Promise<EazePayApiClient> {
  const baseUrl =
    (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
    'http://localhost:3000';
  const deviceId = await ensureDeviceId();
  return new EazePayApiClient({
    baseUrl,
    tokenStore,
    deviceId,
    onAuthLost: () => {
      // App-level routing handled in navigation/AuthContext.
    },
  });
}
