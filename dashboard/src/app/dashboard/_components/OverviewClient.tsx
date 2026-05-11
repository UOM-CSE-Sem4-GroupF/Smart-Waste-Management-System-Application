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
  initialBins:    BinUpdatePayload[]
  initialJobs:    CollectionJob[]
}

// Active job states (CREATED → IN_PROGRESS)
const ACTIVE_STATES = new Set([
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED',
  'CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED',
  'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE',
  'RECORDING_AUDIT',
])

export function OverviewClient({ initialBins, initialJobs }: OverviewClientProps) {
  const { setBins, bins, zoneStats, vehicles } = useMapStore()
  const { setJobs }                            = useJobStore()
  const jobs                                   = useJobStore((s) => s.jobs)

  // Seed stores once with initial SSR data
  useEffect(() => {
    if (initialBins.length > 0) setBins(initialBins)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialJobs.length > 0) setJobs(initialJobs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Derived stats
  const allBins        = useMemo(() => Array.from(bins.values()), [bins])
  const allZones       = useMemo(() => Array.from(zoneStats.values()), [zoneStats])
  const totalBins      = allBins.length
  const urgentCount    = allBins.filter((b) => b.status === 'urgent' || b.status === 'critical').length
  const activeJobs     = Array.from(jobs.values()).filter((j) => ACTIVE_STATES.has(j.state ?? 'CREATED')).length
  const activeVehicles = vehicles.size

  // Top 5 active jobs for the right column
  const recentActiveJobs = useMemo(() => {
    return Array.from(jobs.values())
      .filter((j) => ACTIVE_STATES.has(j.state ?? 'CREATED'))
      .slice(0, 5)
  }, [jobs])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>

      {/* Row 1 — Stat Cards */}
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

      {/* Row 2 — Zone Cards (3/5) + Mini-Map (2/5) */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Zone cards — 3 columns */}
        <div className="lg:col-span-3">
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
            <Card className="rounded-xl shadow-sm h-full">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Zone data will appear here once real-time updates arrive.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Mini-Map — 2 columns */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl shadow-sm overflow-hidden h-64 lg:h-full min-h-64">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Live Map</CardTitle>
                <Link href="/dashboard/map" className="text-xs text-green-600 hover:underline dark:text-green-400">
                  Full map →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-3rem)]">
              <MiniMap compact className="w-full h-full" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 3 — Alerts + Active Jobs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alert Feed */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <AlertFeed limit={20} />
          </CardContent>
        </Card>

        {/* Active Jobs preview */}
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
              recentActiveJobs.map((job) => (
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
