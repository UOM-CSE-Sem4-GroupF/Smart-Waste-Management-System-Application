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
          },
        },
      })
  )

  return (
    <MSWProvider>
      <SessionProvider>
        <SocketProvider>
          <QueryClientProvider client={queryClient}>
            {process.env.NODE_ENV === 'development' && <MockSocketInjector />}
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </SocketProvider>
      </SessionProvider>
    </MSWProvider>
  )
}
