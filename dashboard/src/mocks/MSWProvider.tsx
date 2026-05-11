'use client'
import { useEffect, useState } from 'react'

export function MSWProvider({ children }: { children: React.ReactNode }) {
  // In development, block rendering until the service worker is active so that
  // TanStack Query requests don't fire before MSW can intercept them.
  const [ready, setReady] = useState(process.env.NODE_ENV !== 'development')

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    import('./browser').then(({ worker }) => {
      worker.start({ onUnhandledRequest: 'bypass' }).then(() => setReady(true))
    })
  }, [])

  if (!ready) return null
  return <>{children}</>
}
