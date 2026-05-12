'use client'

import { useEffect } from 'react'
import { useBinStore } from '@/store/binStore'
import type { BinUpdatePayload } from '@/types'

export function MapStoreSeeder({ initialBins }: { initialBins: BinUpdatePayload[] }) {
  const setBins = useBinStore((s) => s.setBins)

  useEffect(() => {
    if (initialBins.length > 0) setBins(initialBins)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
