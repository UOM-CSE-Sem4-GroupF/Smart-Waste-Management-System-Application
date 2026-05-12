'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Trash2, AlertTriangle, Briefcase, Truck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/StatCard'
import { ZoneCard } from '@/components/shared/ZoneCard'
import { AlertFeed } from '@/components/shared/AlertFeed'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import type { BinUpdatePayload, CollectionJob } from '@/types'

const MiniMap = dynamic(() => import('@/components/map/DashboardMap'), { ssr: false })

interface OverviewClientProps {
  initialBins: BinUpdatePayload[]
  initialJobs: CollectionJob[]
}

// Active job states (CREATED → IN_PROGRESS)
const ACTIVE_STATES = new Set([
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED',
  'CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED',
  'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE',
  'RECORDING_AUDIT',
])

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { createClientApiClient } from '@/lib/api-client'
import { normaliseBin, type CoreBin, type CoreCluster, type CoreListResponse } from '@/lib/api/metadata'
import { Loader2 } from 'lucide-react'

export function OverviewClient({ initialBins, initialJobs }: OverviewClientProps) {
  const { data: session } = useSession()
  const { setBins, bins, zoneStats, vehicles } = useMapStore()
  const { setJobs } = useJobStore()
  const jobs = useJobStore((s) => s.jobs)

  // 1. Fetch Bins + Clusters → merge real coordinates → seed map store
  const { isLoading: isLoadingBins } = useQuery({
    queryKey: ['bins-overview-initial', session?.accessToken ?? 'unauthenticated'],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const [binsRes, clustersRes] = await Promise.all([
        api.get('data-analysis/api/v1/bins', { searchParams: { limit: 500 } })
           .json<CoreListResponse<CoreBin>>(),
        api.get('data-analysis/api/v1/clusters', { searchParams: { limit: 200 } })
           .json<CoreListResponse<CoreCluster>>()
           .catch(() => ({ data: [] as CoreCluster[] })),
      ])

      const clusterCoords = new Map(
        clustersRes.data
          .filter(c => Number(c.lat) !== 0 && Number(c.lng) !== 0)
          .map(c => [c.id, { lat: Number(c.lat), lng: Number(c.lng) }])
      )

      const payload: BinUpdatePayload[] = binsRes.data.map(raw => {
        const bin = normaliseBin(raw)
        const lat = bin.lat || clusterCoords.get(raw.cluster_id)?.lat || 0
        const lng = bin.lng || clusterCoords.get(raw.cluster_id)?.lng || 0
        return {
          bin_id:                bin.bin_id,
          cluster_id:            bin.cluster_id,
          cluster_name:          bin.cluster_name,
          zone_id:               bin.zone_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          waste_category:        bin.waste_category as any,
          waste_category_colour: bin.waste_category_colour,
          fill_level_pct:        bin.fill_level_pct ?? 0,
          status:                bin.status,
          urgency_score:         bin.urgency_score,
          estimated_weight_kg:   bin.estimated_weight_kg ?? 0,
          battery_level_pct:     bin.battery_level_pct ?? 100,
          predicted_full_at:     bin.predicted_full_at,
          last_collected_at:     bin.last_collected_at,
          fill_rate_pct_per_hour: 0,
          has_active_job:        false,
          collection_triggered:  false,
          lat,
          lng,
        }
      })

      setBins(payload)
      return payload
    },
    staleTime: 60_000,
  })

  // 2. Fetch Jobs (for active jobs list)
  const { isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs-overview-initial'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const res = await api.get('api/v1/collection-jobs', { searchParams: { limit: 100 } }).json<{ data: any[] }>()
      const payload = res.data as unknown as CollectionJob[]
      setJobs(payload)
      return payload
    },
    enabled: !!session?.accessToken,
  })

  // Derived stats
  const allBins = useMemo(() => Array.from(bins.values()), [bins])
  const allZones = useMemo(() => Array.from(zoneStats.values()), [zoneStats])
  const totalBins = allBins.length
  const urgentCount = allBins.filter((b) => b.status === 'urgent' || b.status === 'critical').length
  const activeJobs = Array.from(jobs.values()).filter((j) => ACTIVE_STATES.has(j.state ?? 'CREATED')).length
  const activeVehicles = vehicles.size

  // Top 5 active jobs for the right column
  const recentActiveJobs = useMemo(() => {
    return Array.from(jobs.values())
      .filter((j) => ACTIVE_STATES.has(j.state ?? 'CREATED'))
      .slice(0, 5)
  }, [jobs])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">System-wide waste collection status at a glance.</p>
      </div>

      {/* Row 1 — Full-width Live Map (~60vh) */}
      <Card className="rounded-xl shadow-sm overflow-hidden" style={{ height: '60vh', minHeight: '360px' }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Map</CardTitle>
            <Link href="/dashboard/map" className="text-xs text-green-600 hover:underline dark:text-green-400">
              Full map →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-3rem)]">
          <MiniMap className="w-full h-full" bins={allBins} />
        </CardContent>
      </Card>

      {/* Row 2 — Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Bins"
          value={totalBins}
          icon={<Trash2 className="h-4 w-4" />}
          sublabel="Across all zones"
        />
        <StatCard
          label="Urgent / Critical"
          value={urgentCount}
          icon={<AlertTriangle className="h-4 w-4" />}
          urgent={urgentCount > 0}
          trend={urgentCount > 0 ? 'down' : 'neutral'}
          trendValue={urgentCount > 0 ? `${urgentCount} need attention` : 'All clear'}
        />
        <StatCard
          label="Active Jobs"
          value={activeJobs}
          icon={<Briefcase className="h-4 w-4" />}
          href="/dashboard/jobs"
          sublabel="Tap to view all"
        />
        <StatCard
          label="Vehicles On Road"
          value={activeVehicles}
          icon={<Truck className="h-4 w-4" />}
          href="/dashboard/operations"
          sublabel="Active now"
        />
      </div>

      {/* Row 3 — Zone Cards (3/5) + right column (2/5) */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Zone cards */}
        <div className="lg:col-span-3 space-y-4">
          {allZones.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {allZones.map((zone) => (
                <ZoneCard
                  key={zone.zone_id}
                  zone={zone}
                  href={`/dashboard/bins?zone_id=${zone.zone_id}`}
                />
              ))}
            </div>
          ) : (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Zone data will appear here once real-time updates arrive.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Active Jobs moved here to fill free space */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Jobs
              </CardTitle>
              <Link
                href="/dashboard/jobs"
                className="text-xs text-green-600 hover:underline dark:text-green-400"
              >
                View all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActiveJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active jobs right now.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentActiveJobs.map((job) => (
                    <Link
                      key={job.job_id}
                      href={`/dashboard/jobs`}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                    >
                      <div>
                        <span className="font-medium">{job.job_id.slice(0, 8)}…</span>
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          {job.job_type} · {job.zone_name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {(job.state ?? 'active').toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Alerts + Active Jobs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Alert Feed */}
          <Card className="rounded-xl shadow-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 h-[calc(100%-4rem)] overflow-y-auto">
              <AlertFeed limit={12} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
