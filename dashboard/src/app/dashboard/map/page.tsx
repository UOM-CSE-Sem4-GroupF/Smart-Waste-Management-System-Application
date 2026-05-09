import { createApiClient } from '@/lib/api-client'
import { getBins } from '@/lib/api/bins'
import { MapClient } from './_components/MapClient'
import type { BinUpdatePayload } from '@/types'

export default async function MapPage() {
  let initialBins: BinUpdatePayload[] = []

  try {
    const api = await createApiClient()
    const res = await getBins(api, { limit: 500 })
    initialBins = res.data as unknown as BinUpdatePayload[]
  } catch {
    // backend unavailable — map starts empty, socket updates will populate it
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Live City Map</h2>
      <MapClient initialBins={initialBins} />
    </div>
  )
}
