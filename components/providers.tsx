'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { ServiceWorkerRegister } from './sw-register';
import { ErrorBoundary } from './error-boundary';

/**
 * App-wide TanQuery client.
 *
 * staleTime: 30s — data considered fresh for 30s, then refetches on focus/mount.
 * refetchOnWindowFocus: true — coming back to the tab pulls latest.
 * refetchOnReconnect: true — restoring network triggers refetch.
 * refetchInterval: 60s background — passive auto-refresh while tab is open.
 *
 * Pages that need faster cadence (e.g. /sod with sync-in-progress) can override
 * via the `refetchInterval` option per-query.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchInterval: 60_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ServiceWorkerRegister />
      <ErrorBoundary>{children}</ErrorBoundary>
      <Toaster richColors position="top-right" theme="dark" />
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
