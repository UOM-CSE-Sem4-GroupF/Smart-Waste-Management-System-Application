import { createApiClient } from '@/lib/api-client'
import { getBins } from '@/lib/api/bins'
import { CityMap } from '@/components/map/CityMap'
import { MapStoreSeeder } from './_components/MapStoreSeeder'
import type { BinUpdatePayload } from '@/types'

export default async function MapPage() {
  let initialBins: BinUpdatePayload[] = []

  try {
    const api = await createApiClient()
    const res = await getBins(api, { limit: 500 })
    initialBins = res.data as unknown as BinUpdatePayload[]
  } catch {
    // Backend unavailable — map will populate via socket
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Live City Map</h2>
      <MapStoreSeeder initialBins={initialBins} />
      <CityMap />
    </div>
  )
}
