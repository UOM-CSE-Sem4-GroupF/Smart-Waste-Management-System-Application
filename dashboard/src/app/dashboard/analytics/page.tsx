'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, startOfDay } from 'date-fns'
import { useMapStore } from '@/store/mapStore'
import { createClientApiClient } from '@/lib/api-client'
import { getWasteGenerationTrends } from '@/lib/api/ml'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ChartCard } from '@/components/analytics/ChartCard'
import { ZoneFillTrendsChart } from '@/components/analytics/ZoneFillTrendsChart'
import { WasteCategoryChart } from '@/components/analytics/WasteCategoryChart'
import { FillRateHeatmap } from '@/components/analytics/FillRateHeatmap'
import { CollectionEfficiencyChart } from '@/components/analytics/CollectionEfficiencyChart'
import { VehicleUtilisationChart } from '@/components/analytics/VehicleUtilisationChart'
import { ZoneForecastChart } from '@/components/analytics/ZoneForecastChart'
import { JobTypeBreakdownChart } from '@/components/analytics/JobTypeBreakdownChart'

const ACTIVE_STATES = new Set([
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED', 'CLUSTER_ASSEMBLING',
  'CLUSTER_ASSEMBLED', 'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE', 'RECORDING_AUDIT',
])

export default function AnalyticsPage() {
  const { data: session } = useSession()

  // ── REST: jobs (last 100) ──────────────────────────────────────────────────
  const { data: jobsResponse, isLoading: jobsLoading } = useQuery({
    queryKey: ['analytics', 'jobs', session?.accessToken ?? 'unauthenticated'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const result = await api
        .get('api/v1/collection-jobs', { searchParams: { limit: 100 } })
        .json<{ data: import('@/types').CollectionJobListItem[]; total: number; page: number }>()
        .catch((e) => { console.warn('[Analytics] jobs fetch failed:', e); return { data: [], total: 0, page: 1 } })
      console.log('[Analytics] jobs:', result.data.length, 'total:', result.total)
      return result
    },
    staleTime: 2 * 60_000,
    retry: 1,
  })
  const jobsList = jobsResponse?.data ?? []

  // ── REST: bins (limit 500) ─────────────────────────────────────────────────
  const { data: binsResponse, isLoading: binsLoading } = useQuery({
    queryKey: ['analytics', 'bins', session?.accessToken ?? 'unauthenticated'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const result = await api
        .get('api/v1/bins', { searchParams: { limit: 500 } })
        .json<{ data: import('@/types').Bin[]; total: number; page: number; limit: number }>()
        .catch((e) => { console.warn('[Analytics] bins fetch failed:', e); return { data: [], total: 0, page: 1, limit: 500 } })
      console.log('[Analytics] bins:', result.data.length, 'total:', result.total)
      return result
    },
    staleTime: 2 * 60_000,
    retry: 1,
  })
  const binsList = binsResponse?.data ?? []

  // ── Zone fill trends (ML REST) — graceful fallback on error ───────────────
  const { data: trendsRaw } = useQuery({
    queryKey: ['ml', 'waste-trends'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const result = await api
        .get('api/v1/ml/trends/waste-generation', { searchParams: { period: 'week' } })
        .json<unknown>()
        .catch((e) => { console.warn('[Analytics] ML trends fetch failed:', e); return null })
      console.log('[Analytics] ML trends result:', result)
      return result
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  // ── Zone stats from socket (fill trends chart + heatmap zone names) ────────
  const zones = useMapStore((s) => s.zoneStats)

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime()
    const activeJobs = jobsList.filter((j) => ACTIVE_STATES.has(j.state)).length
    const completedToday = jobsList.filter((j) =>
      (j.state === 'COMPLETED' || j.state === 'AUDIT_RECORDED') &&
      j.completed_at != null &&
      new Date(j.completed_at).getTime() >= todayStart,
    ).length
    const avgFill = binsList.length > 0
      ? binsList.reduce((s, b) => s + b.fill_level_pct, 0) / binsList.length
      : 0
    const urgentCritical = binsList.filter((b) => b.status === 'urgent' || b.status === 'critical').length
    return { activeJobs, completedToday, avgFill, urgentCritical }
  }, [jobsList, binsList])

  // ── Waste category chart — grouped from REST bins ─────────────────────────
  const categoryData = useMemo(() => {
    const totals: Record<string, { count: number; total_kg: number }> = {}
    for (const bin of binsList) {
      const cat = bin.waste_category ?? 'general'
      const entry = totals[cat] ?? { count: 0, total_kg: 0 }
      totals[cat] = { count: entry.count + 1, total_kg: entry.total_kg + bin.estimated_weight_kg }
    }
    return Object.entries(totals).map(([name, v]) => ({
      name:  name.replace(/_/g, ' '),
      bins:  v.count,
      kg:    parseFloat(v.total_kg.toFixed(1)),
    }))
  }, [binsList])

  // ── Urgent bins table — filtered from REST bins ────────────────────────────
  const urgentPredictions = useMemo(() => {
    const now = Date.now()
    return binsList
      .filter((b) => b.predicted_full_at != null)
      .map((b) => ({
        ...b,
        hoursRemaining: (new Date(b.predicted_full_at!).getTime() - now) / 3_600_000,
      }))
      .filter((b) => b.hoursRemaining > 0 && b.hoursRemaining < 48)
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining)
      .slice(0, 25)
  }, [binsList])

  // ── Heatmap data — from ML trends series ─────────────────────────────────
  const heatmapData = useMemo(() => {
    if (!trendsRaw || typeof trendsRaw !== 'object') return []
    const raw = trendsRaw as {
      series?: Array<{ timestamp: string; zone_id: number; zone_name?: string; avg_fill_pct: number }>
    }
    if (!Array.isArray(raw.series)) return []
    return raw.series.map((pt) => ({
      zone_id:   pt.zone_id,
      zone_name: pt.zone_name ?? `Zone ${pt.zone_id}`,
      hour:      new Date(pt.timestamp).getHours(),
      avg_fill:  pt.avg_fill_pct,
    }))
  }, [trendsRaw])

  // ── Zone names map for fill trends chart ──────────────────────────────────
  const zoneNamesMap = useMemo(() => {
    const m: Record<string, string> = {}
    zones.forEach((z) => { m[`zone_${z.zone_id}`] = z.zone_name })
    return m
  }, [zones])

  // ── Zone fill trends chart data ────────────────────────────────────────────
  const trendsData = useMemo(() => {
    if (!trendsRaw || typeof trendsRaw !== 'object') return []
    const raw = trendsRaw as {
      series?: Array<{ timestamp: string; zone_id: number; avg_fill_pct: number }>
    }
    if (!Array.isArray(raw.series)) return []
    const byTime: Record<string, Record<string, number>> = {}
    raw.series.forEach((pt) => {
      const key = new Date(pt.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      byTime[key] ??= {}
      byTime[key][`zone_${pt.zone_id}`] = parseFloat(pt.avg_fill_pct.toFixed(1))
    })
    return Object.entries(byTime).map(([date, values]) => ({ date, ...values }))
  }, [trendsRaw])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill trends, collection efficiency and waste category breakdowns.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Jobs"       value={kpi.activeJobs}               loading={jobsLoading} />
        <KpiCard label="Completed Today"   value={kpi.completedToday}           loading={jobsLoading} />
        <KpiCard label="Avg Fill Level"    value={`${kpi.avgFill.toFixed(1)}%`} loading={binsLoading} />
        <KpiCard
          label="Urgent / Critical"
          value={kpi.urgentCritical}
          loading={binsLoading}
          accent={kpi.urgentCritical > 0}
        />
      </div>

      {/* Row 1: Fill trends + Waste categories */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Zone Fill Level — Last 7 Days"
          description="Average fill % per zone from trend data"
        >
          <ZoneFillTrendsChart data={trendsData} zoneNames={zoneNamesMap} isLoading={false} />
        </ChartCard>

        <ChartCard
          title="Waste Category Breakdown"
          description="Weight and bin count by waste type across all zones"
        >
          <WasteCategoryChart data={categoryData} />
        </ChartCard>
      </div>

      {/* Row 2: Fill rate heatmap */}
      <ChartCard
        title="Fill Rate Heatmap"
        description="Average fill % by zone and hour of day"
      >
        <FillRateHeatmap data={heatmapData} />
      </ChartCard>

      {/* Row 3: Collection efficiency + Vehicle utilisation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Collection Efficiency"
          description="Planned vs actual job duration across recent collections"
        >
          <CollectionEfficiencyChart jobs={jobsList} isLoading={jobsLoading} />
        </ChartCard>

        <ChartCard
          title="Vehicle Utilisation"
          description="Job load per vehicle — grey under-utilised, emerald optimal, orange over-utilised"
        >
          <VehicleUtilisationChart jobs={jobsList} isLoading={jobsLoading} />
        </ChartCard>
      </div>

      {/* Row 4: Job distribution (full width) */}
      <ChartCard
        title="Job Distribution"
        description="Breakdown by type (Emergency / Routine) and current state"
      >
        <JobTypeBreakdownChart jobs={jobsList} />
      </ChartCard>

      {/* Row 5: 7-day zone forecast (full width) */}
      <ChartCard
        title="7-Day Zone Forecast"
        description="Predicted fill level for next 7 days with confidence intervals"
      >
        <ZoneForecastChart />
      </ChartCard>

      {/* Bins predicted to hit urgent */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Bins Predicted to Hit Urgent (next 48 h)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {urgentPredictions.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No bins with imminent fill predictions.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bin ID</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Fill %</TableHead>
                  <TableHead>Predicted Full</TableHead>
                  <TableHead className="text-right">Hours Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urgentPredictions.map((bin) => (
                  <TableRow key={bin.bin_id} className="hover:bg-accent/50">
                    <TableCell className="font-medium">{bin.bin_id}</TableCell>
                    <TableCell>Zone {bin.zone_id}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {bin.fill_level_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDistanceToNow(new Date(bin.predicted_full_at!), { addSuffix: true })}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${
                      bin.hoursRemaining < 6
                        ? 'text-red-500'
                        : bin.hoursRemaining < 12
                          ? 'text-orange-500'
                          : ''
                    }`}>
                      {bin.hoursRemaining.toFixed(1)} h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  loading,
  accent,
}: {
  label:    string
  value:    number | string
  loading?: boolean
  accent?:  boolean
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1 h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className={`mt-1 text-3xl font-bold tabular-nums ${accent ? 'text-orange-500' : ''}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
