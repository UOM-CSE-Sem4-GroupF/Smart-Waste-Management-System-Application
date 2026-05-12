'use client'
import { useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { createClientApiClient } from '@/lib/api-client'
import { normaliseBin, type CoreBin, type CoreCluster, type CoreListResponse, type HierarchyBin } from '@/lib/api/metadata'
import { useMapStore } from '@/store/mapStore'
import { BinDetailPanel } from '@/components/map/BinDetailPanel'
import { VehicleDetailPanel } from '@/components/map/VehicleDetailPanel'
import { MapFilterBar } from '@/components/map/MapFilterBar'
import { Loader2 } from 'lucide-react'
import type { BinUpdatePayload } from '@/types'

const DashboardMap = dynamic(
  () => import('@/components/map/DashboardMap'),
  { ssr: false, loading: () => <div className="flex-1 h-full bg-muted animate-pulse flex items-center justify-center text-muted-foreground">Initialising Map...</div> },
)

function toMapBin(bin: HierarchyBin): BinUpdatePayload {
  return {
    bin_id: bin.bin_id,
    cluster_id: bin.cluster_id,
    cluster_name: bin.cluster_name,
    zone_id: bin.zone_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waste_category: bin.waste_category as any,
    waste_category_colour: bin.waste_category_colour,
    fill_level_pct: bin.fill_level_pct ?? 0,
    status: bin.status,
    urgency_score: bin.urgency_score,
    estimated_weight_kg: bin.estimated_weight_kg ?? 0,
    battery_level_pct: bin.battery_level_pct ?? 100,
    predicted_full_at: bin.predicted_full_at,
    last_collected_at: bin.last_collected_at,
    fill_rate_pct_per_hour: 0,
    has_active_job: false,
    collection_triggered: false,
    lat: bin.lat,
    lng: bin.lng,
  }
}

interface MapPageClientProps {
  initialBins: BinUpdatePayload[]
}

export function MapPageClient({ initialBins }: MapPageClientProps) {
  const { data: session } = useSession()
  const setBins = useMapStore(s => s.setBins)

  // Fetch Bins and Clusters in parallel; re-fires when token becomes available
  const { data: binsData, isLoading: isLoadingBins, error: binsError } = useQuery({
    queryKey: ['bins-map-initial', session?.accessToken ?? 'unauthenticated'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const res = await api.get('data-analysis/api/v1/bins', { searchParams: { limit: 500 } }).json<CoreListResponse<CoreBin>>()
      console.log('[MapPageClient] bins fetched:', res.data?.length, '| sample:', res.data?.[0] && { id: res.data[0].id, lat: res.data[0].lat, lng: res.data[0].lng })
      return res.data
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const { data: clustersData, error: clustersError } = useQuery({
    queryKey: ['clusters-map-initial', session?.accessToken ?? 'unauthenticated'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const res = await api.get('data-analysis/api/v1/clusters', { searchParams: { limit: 200 } }).json<CoreListResponse<CoreCluster>>()
      return res.data
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (binsError) console.error('[MapPageClient] bins fetch error:', binsError)
    if (clustersError) console.error('[MapPageClient] clusters fetch error:', clustersError)
  }, [binsError, clustersError])

  // Merge cluster coordinates into bins that have lat=0
  const mergedBins = useMemo(() => {
    if (!binsData) {
      console.log('[MapPageClient] no binsData yet, showing initialBins:', initialBins.length)
      return initialBins
    }

    const clusterCoords = new Map(
      (clustersData || [])
        .filter(c => Number(c.lat) !== 0 && Number(c.lng) !== 0)
        .map(c => [c.id, { lat: Number(c.lat), lng: Number(c.lng) }])
    )
    console.log('[MapPageClient] clusterCoords with real coords:', clusterCoords.size)

    const result = binsData.map(raw => {
      const bin = normaliseBin(raw)
      if (!bin.lat && !bin.lng) {
        const fallback = clusterCoords.get(raw.cluster_id)
        if (fallback) { bin.lat = fallback.lat; bin.lng = fallback.lng }
      }
      return toMapBin(bin)
    })

    const withCoords = result.filter(b => b.lat && b.lng).length
    console.log('[MapPageClient] mergedBins:', result.length, '| with coords:', withCoords, '| sample:', result[0] && { bin_id: result[0].bin_id, lat: result[0].lat, lng: result[0].lng, status: result[0].status })
    return result
  }, [binsData, clustersData, initialBins])

  useEffect(() => {
    if (mergedBins.length > 0) {
      setBins(mergedBins)
    }
  }, [mergedBins, setBins])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Live City Map</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time bin and vehicle positions across all zones.</p>
        </div>
        {isLoadingBins && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-right-4">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading live positions...
          </div>
        )}
      </div>

      <MapFilterBar />

      <div className="flex flex-1 min-h-0 rounded-xl overflow-hidden border relative bg-muted/20">
        <DashboardMap className="flex-1 h-full min-w-0" bins={mergedBins} />
        <BinDetailPanel />
        <VehicleDetailPanel />
      </div>
    </div>
  )
}

