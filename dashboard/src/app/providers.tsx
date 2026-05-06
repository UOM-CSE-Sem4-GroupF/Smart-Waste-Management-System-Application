'use client'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { SocketProvider } from '@/components/providers/SocketProvider'
import { MSWProvider } from '@/mocks/MSWProvider'
import { MockSocketInjector } from '@/mocks/MockSocketInjector'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,     // 30 s
            gcTime:    5 * 60 * 1000, // 5 min
            retry:     false,         // Don't retry failed requests in mock mode
          },
        },
      })
  )

  return (
    // <MSWProvider>
      <SessionProvider>
        <SocketProvider>
          <QueryClientProvider client={queryClient}>
            {/* The injector simulates real-time events in the browser during dev */}
            {/* <MockSocketInjector /> */}
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </SocketProvider>
      </SessionProvider>
    // </MSWProvider>
  )
}

