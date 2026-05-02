import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { buildApiClient } from './api.js';
import type { EazePayApiClient } from '@eazepay/api-client';

type AuthState = 'unknown' | 'unauthenticated' | 'authenticated';

interface AuthStore {
  state: AuthState;
  client: EazePayApiClient | null;
  init: () => Promise<void>;
  setAuthenticated: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  state: 'unknown',
  client: null,
  async init() {
    const client = await buildApiClient();
    const refresh = await SecureStore.getItemAsync('eazepay.refresh');
    set({ client, state: refresh ? 'authenticated' : 'unauthenticated' });
  },
  setAuthenticated() {
    set({ state: 'authenticated' });
  },
  async signOut() {
    const c = get().client;
    if (c) await (c as { tokenStore?: { clear: () => Promise<void> } }).tokenStore?.clear?.();
    set({ state: 'unauthenticated' });
  },
}));
