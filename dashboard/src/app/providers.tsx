'use client'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { SocketProvider } from '@/components/providers/SocketProvider'
import { MSWProvider } from '@/mocks/MSWProvider'
import { MockSocketInjector } from '@/mocks/MockSocketInjector'
import { MockSessionProvider } from '@/mocks/MockSessionProvider'

const IS_DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime:    5 * 60 * 1000,
          },
        },
      })
  )

  if (IS_DEV_BYPASS) {
    return (
      <MSWProvider>
        <MockSessionProvider>
          <QueryClientProvider client={queryClient}>
            <MockSocketInjector />
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </MockSessionProvider>
      </MSWProvider>
    )
  }

  return (
    <SessionProvider>
      <SocketProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </SocketProvider>
    </SessionProvider>
  )
}
