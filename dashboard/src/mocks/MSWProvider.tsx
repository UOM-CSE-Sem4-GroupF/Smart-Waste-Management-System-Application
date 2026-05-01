'use client'
import { useEffect } from 'react'

export function MSWProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    import('./browser').then(({ worker }) => {
      worker.start({ onUnhandledRequest: 'bypass' })
    })
  }, [])

  return <>{children}</>
}
