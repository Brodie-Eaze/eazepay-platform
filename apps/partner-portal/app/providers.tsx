'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Client-side providers shared across every authenticated route.
 *
 * Holds the TanStack Query client. Mirrors the Lovable platform's
 * provider tree so every page imported from `useApi` + `useQuery` /
 * `useMutation` works out of the box.
 *
 * The client is held in `useState` so the same instance is reused
 * across rerenders (Next.js App Router will otherwise re-create it on
 * every Server-Component → Client-Component boundary).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Don't refetch on window focus for ops dashboards — too
            // jumpy when staff alt-tab between tabs.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
