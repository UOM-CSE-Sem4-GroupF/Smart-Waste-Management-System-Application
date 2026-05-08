'use client'
import { SessionProvider } from 'next-auth/react'

// Fake session injected when NEXT_PUBLIC_DEV_BYPASS=true.
// accessToken is a dummy JWT-shaped string so !!session?.accessToken is truthy
// and MSW intercepts all real network calls before they leave the browser.
const MOCK_SESSION = {
  user: {
    name:   'Dev Admin',
    email:  'dev@swms.local',
    image:  null,
    role:   'admin' as const,
    zoneId: null,
  },
  accessToken: 'mock.eyJzdWIiOiJkZXYiLCJyb2xlIjoiYWRtaW4ifQ.mock',
  expires: new Date(Date.now() + 24 * 3600_000).toISOString(),
}

export function MockSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={MOCK_SESSION as never}>
      {children}
    </SessionProvider>
  )
}
