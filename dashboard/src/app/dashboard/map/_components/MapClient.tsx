'use client'

import { useEffect } from 'react'
import { useBinStore } from '@/store/binStore'
import { CityMap } from '@/components/map/CityMap'
import type { BinUpdatePayload } from '@/types'

export function MapClient({ initialBins }: { initialBins: BinUpdatePayload[] }) {
  const setBins = useBinStore((s) => s.setBins)

  useEffect(() => {
    if (initialBins.length > 0) setBins(initialBins)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <CityMap />
}
