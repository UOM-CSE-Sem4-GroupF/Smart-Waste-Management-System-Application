'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import type { CollectionJob } from '@/types/job'
import type { Bin, CollectionJobListItem } from '@/types'
import { createClientApiClient } from '@/lib/api-client'
import {
  getWasteGenerationTrends,
  getZoneGenerationPrediction,
  getFillTimePrediction,
  type WasteGenerationTrend,
  type ZoneGenerationPrediction,
  type FillTimePrediction,
} from '@/lib/api/ml'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ChartCard } from '@/components/analytics/ChartCard'
import { ZoneFillTrendsChart } from '@/components/analytics/ZoneFillTrendsChart'
import { WasteCategoryChart } from '@/components/analytics/WasteCategoryChart'
import { FillRateHeatmap } from '@/components/analytics/FillRateHeatmap'
import { CollectionEfficiencyChart } from '@/components/analytics/CollectionEfficiencyChart'
import { VehicleUtilisationChart } from '@/components/analytics/VehicleUtilisationChart'
import type { ActiveVehicle } from '@/components/analytics/VehicleUtilisationChart'
import { ZoneForecastChart } from '@/components/analytics/ZoneForecastChart'
import { JobTypeBreakdownChart } from '@/components/analytics/JobTypeBreakdownChart'
import { AnomalyDetectionTab } from '@/components/analytics/AnomalyDetectionTab'
import { WastePatternPredictionTab } from '@/components/analytics/WastePatternPredictionTab'

interface ApiZone {
  zone_id:                  string
  zone_name:                string
  avg_fill_pct:             number
  total_estimated_weight_kg: number
}

export default function AnalyticsPage() {
  const { data: session } = useSession()

  // ── Zone stats from Zustand (populated via zone:stats socket events) ──────
  const zones = useMapStore((s) => s.zoneStats)
  const bins  = useMapStore((s) => s.bins)

  // Zone IDs from socket store (immediate, no extra fetch needed)
  const socketZoneIds = useMemo(() => Array.from(zones.keys()), [zones])

  // REST API zones: always fetch when session available (socket fallback if it beats this)
  const { data: zonesApiData } = useQuery({
    queryKey: ['zones'],
    queryFn: () =>
      createClientApiClient(session?.accessToken)
        .get('api/v1/zones')
        .json<{ data: ApiZone[] }>(),
    enabled:   !!session?.accessToken,
    staleTime: 5 * 60_000,
    retry:     false,
  })

  const apiZones = zonesApiData?.data ?? []

  // DB-backed fallback: core-api city-zones (always fetched; used when bin-status store is empty)
  const { data: cityZonesData } = useQuery({
    queryKey: ['city-zones', 'core-api'],
    queryFn: () =>
      createClientApiClient(session?.accessToken)
        .get('data-analysis/api/v1/city-zones')
        .json<{ data: Array<{ id: number; name: string; active: boolean }> }>(),
    enabled:   !!session?.accessToken,
    staleTime: 30 * 60_000,
    retry:     false,
  })
  const cityZoneIds = useMemo(
    () => (cityZonesData?.data ?? []).filter((z) => z.active !== false).map((z) => z.id),
    [cityZonesData],
  )

  // Prefer socket zone IDs → bin-status REST → core-api DB-backed
  const zoneIds = useMemo(
    () => socketZoneIds.length > 0
      ? socketZoneIds
      : apiZones.length > 0
        ? apiZones.map((z) => Number(z.zone_id))
        : cityZoneIds,
    [socketZoneIds, apiZones, cityZoneIds],
  )

  // ── Waste generation trends per zone (parallel) ───────────────────────────
  const { data: allZoneTrends, isFetching: trendsFetching } = useQuery({
    queryKey: ['ml', 'waste-trends', zoneIds],
    queryFn:  async () => {
      const api = createClientApiClient(session?.accessToken)
      return Promise.all(
        zoneIds.map((id) => getWasteGenerationTrends(api, { zone_id: id, period: 'week' })),
      )
    },
    enabled:   !!session?.accessToken && zoneIds.length > 0,
    staleTime: 5 * 60_000,
    retry:     false,
  })

  // ── Zone generation predictions per zone (for category chart fallback) ────
  const { data: allZonePredictions } = useQuery({
    queryKey: ['ml', 'zone-predictions', zoneIds],
    queryFn:  async () => {
      const api = createClientApiClient(session?.accessToken)
      return Promise.all(
        zoneIds.map((id) => getZoneGenerationPrediction(api, id)),
      )
    },
    enabled:   !!session?.accessToken && zoneIds.length > 0,
    staleTime: 15 * 60_000,
    retry:     false,
  })

  // Zone names map — core-api as base, overridden by REST, then socket (most authoritative)
  const zoneNamesMap = useMemo(() => {
    const m: Record<string, string> = {}
    cityZonesData?.data.forEach((z) => { m[`zone_${z.id}`] = z.name })
    apiZones.forEach((z) => { m[`zone_${z.zone_id}`] = z.zone_name })
    zones.forEach((z, id) => { m[`zone_${id}`] = z.zone_name })
    return m
  }, [apiZones, zones, cityZonesData])

  // Reshape per-zone trend responses into flat rows keyed by period label
  const trendsData = useMemo(() => {
    if (!allZoneTrends?.length) return []
    const firstZone = allZoneTrends[0] as WasteGenerationTrend
    if (!firstZone?.series?.length) return []

    return firstZone.series.map((_, periodIdx) => {
      const row: { date: string; [k: string]: number | string } = {
        date: firstZone.series[periodIdx].label,
      }
      allZoneTrends.forEach((zoneTrend) => {
        const pt = (zoneTrend as WasteGenerationTrend).series[periodIdx]
        if (!pt) return
        const { label: _label, ...categories } = pt
        const totalKg = Object.values(categories).reduce(
          (sum, v) => sum + (v as number), 0,
        )
        row[`zone_${(zoneTrend as WasteGenerationTrend).zone_id}`] = parseFloat(totalKg.toFixed(1))
      })
      return row
    })
  }, [allZoneTrends])

  // Waste category bar chart — try socket store first, fall back to ML predictions
  const categoryData = useMemo(() => {
    // Socket store has real breakdown data
    const hasSocketData = zones.size > 0 &&
      Array.from(zones.values()).some((z) => Object.keys(z.category_breakdown ?? {}).length > 0)

    if (hasSocketData) {
      const totals: Record<string, { count: number; total_kg: number }> = {}
      zones.forEach((z) => {
        Object.entries(z.category_breakdown ?? {}).forEach(([cat, v]) => {
          const existing = totals[cat] ?? { count: 0, total_kg: 0 }
          totals[cat] = {
            count:    existing.count    + v.count,
            total_kg: existing.total_kg + v.total_kg,
          }
        })
      })
      return Object.entries(totals).map(([name, v]) => ({
        name: name.replace(/_/g, ' '),
        bins: v.count,
        kg:   parseFloat(v.total_kg.toFixed(1)),
      }))
    }

    // Fallback: sum by_waste_category from ML predictions
    if (allZonePredictions?.length) {
      const totals: Record<string, number> = {}
      allZonePredictions.forEach((z) => {
        Object.entries((z as ZoneGenerationPrediction).by_waste_category).forEach(([cat, kg]) => {
          totals[cat] = (totals[cat] ?? 0) + (kg as number)
        })
      })
      return Object.entries(totals).map(([name, kg]) => ({
        name: name.replace(/_/g, ' '),
        bins: 0,
        kg:   parseFloat((kg as number).toFixed(1)),
      }))
    }

    return []
  }, [zones, allZonePredictions])

  // Fetch all bins — limit=200 covers most deployments; used for fill predictions + anomaly detection
  const { data: binsApiData, isFetching: binsLoading } = useQuery({
    queryKey: ['bins', 'analytics'],
    queryFn: () =>
      createClientApiClient(session?.accessToken)
        .get('api/v1/bins', { searchParams: { limit: '200' } })
        .json<{ data: Bin[] }>(),
    enabled:   !!session?.accessToken,
    staleTime: 2 * 60_000,
    retry:     false,
  })

  // For bins above 30% fill, fetch fill-time predictions in parallel
  const candidateBins = useMemo(
    () => (binsApiData?.data ?? []).filter((b) => b.fill_level_pct >= 30),
    [binsApiData],
  )

  const { data: fillPredictions } = useQuery({
    queryKey: ['ml', 'fill-time', candidateBins.map((b) => b.bin_id)],
    queryFn: () => {
      const api = createClientApiClient(session?.accessToken)
      return Promise.allSettled(
        candidateBins.map((b) =>
          getFillTimePrediction(api, b.bin_id, b.fill_level_pct),
        ),
      )
    },
    enabled:   !!session?.accessToken && candidateBins.length > 0,
    staleTime: 5 * 60_000,
    retry:     false,
  })

  // Merge REST bins + fill-time predictions; fall back to socket store bins
  const urgentPredictions = useMemo(() => {
    const now = Date.now()

    // Build prediction map from fill-time API results
    const predMap = new Map<string, FillTimePrediction>()
    fillPredictions?.forEach((result, i) => {
      if (result.status === 'fulfilled') predMap.set(candidateBins[i].bin_id, result.value)
    })

    // Prefer REST bins (with ML predictions merged in); fall back to socket store
    const binSource = binsApiData?.data?.length
      ? binsApiData.data.map((b) => {
          const pred = predMap.get(b.bin_id)
          return pred ? { ...b, predicted_full_at: pred.predicted_full_at } : b
        })
      : Array.from(bins.values())

    return binSource
      .filter((b) => b.predicted_full_at != null)
      .map((b) => ({
        ...b,
        hoursRemaining: (new Date(b.predicted_full_at!).getTime() - now) / 3_600_000,
      }))
      .filter((b) => b.hoursRemaining > 0 && b.hoursRemaining < 48)
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining)
      .slice(0, 25)
  }, [binsApiData, fillPredictions, candidateBins, bins])

  // Collection efficiency + vehicle utilisation — REST fetch so analytics works standalone
  const { data: jobsApiData } = useQuery({
    queryKey: ['collection-jobs', 'analytics'],
    queryFn: () =>
      createClientApiClient(session?.accessToken)
        .get('api/v1/collection-jobs')
        .json<{ data: Record<string, unknown>[] }>(),
    enabled:   !!session?.accessToken,
    staleTime: 2 * 60_000,
    retry:     false,
  })

  // Merge REST jobs with socket-pushed jobs (socket wins for live jobs)
  const socketJobs = useJobStore((s) => s.jobs)
  const jobsList = useMemo(() => {
    const result = new Map<string, Record<string, unknown>>()
    // Seed from REST (uses job_id as key)
    ;(jobsApiData?.data ?? []).forEach((j) => {
      const id = (j.job_id ?? j.id) as string
      if (id) result.set(id, j)
    })
    // Socket jobs override REST for the same id
    socketJobs.forEach((j, id) => result.set(id, j as unknown as Record<string, unknown>))
    return Array.from(result.values())
  }, [jobsApiData, socketJobs])

  // Anomaly count for tab badge — derived from the bins already fetched above
  const allBinsData = binsApiData?.data ?? []
  const anomalyCount = useMemo(
    () => allBinsData.filter((b) => {
      const lowBat = b.battery_level_pct != null && b.battery_level_pct < 20
      return b.status === 'offline' || b.status === 'critical' || b.status === 'urgent' || lowBat
    }).length,
    [allBinsData],
  )

  // Active vehicles — real cargo utilisation from the fleet service
  const { data: vehiclesApiData } = useQuery({
    queryKey: ['vehicles', 'active', 'analytics'],
    queryFn: () =>
      createClientApiClient(session?.accessToken)
        .get('api/v1/vehicles/active')
        .json<{ vehicles: ActiveVehicle[] }>(),
    enabled:   !!session?.accessToken,
    staleTime: 2 * 60_000,
    retry:     false,
  })
  const activeVehicles = vehiclesApiData?.vehicles ?? []

  // Fill-rate heatmap — use current zone fill % for the current hour
  const heatmapData = useMemo(() => {
    const currentHour = new Date().getHours()
    // Prefer socket zone stats (more up-to-date); fall back to REST zones
    if (zones.size > 0) {
      return Array.from(zones.entries()).map(([id, z]) => ({
        zone_id:   id,
        zone_name: z.zone_name,
        hour:      currentHour,
        avg_fill:  z.avg_fill_level_pct,
      }))
    }
    return apiZones.map((z) => ({
      zone_id:   Number(z.zone_id),
      zone_name: z.zone_name,
      hour:      currentHour,
      avg_fill:  z.avg_fill_pct,
    }))
  }, [zones, apiZones])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Waste generation trends, collection efficiency and category breakdowns.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="predictions">Waste Pattern Prediction</TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2">
            Anomaly Detection
            {anomalyCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                {anomalyCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Row 1: Waste generation trends + Waste categories */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Zone Waste Generation — Last 7 Days"
              description="Total waste kg per zone across 7 periods"
            >
              <ZoneFillTrendsChart
                data={trendsData}
                zoneNames={zoneNamesMap}
                isLoading={trendsFetching}
                unit=" kg"
              />
            </ChartCard>

            <ChartCard
              title="Waste Category Breakdown"
              description="Predicted weight by waste type across all zones"
            >
              <WasteCategoryChart data={categoryData} />
            </ChartCard>
          </div>

          {/* Row 2: Fill rate heatmap */}
          <ChartCard
            title="Fill Rate Heatmap"
            description="Current fill % by zone — showing live snapshot for the current hour"
          >
            <FillRateHeatmap data={heatmapData} />
          </ChartCard>

          {/* Row 3: Collection efficiency + Vehicle utilisation */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Collection Efficiency"
              description="Planned vs actual collection progress across recent jobs"
            >
              <CollectionEfficiencyChart jobs={jobsList as unknown as CollectionJob[]} />
            </ChartCard>

            <ChartCard
              title="Vehicle Utilisation"
              description="Cargo utilisation per active vehicle — grey under-utilised, emerald optimal, orange over-utilised"
            >
              <VehicleUtilisationChart
                vehicles={activeVehicles}
                jobs={jobsList as unknown as CollectionJob[]}
              />
            </ChartCard>
          </div>

          {/* Row 4: Job distribution */}
          <ChartCard
            title="Job Distribution"
            description="Breakdown by type (Emergency / Routine) and current state"
          >
            <JobTypeBreakdownChart jobs={jobsList as unknown as CollectionJobListItem[]} />
          </ChartCard>

          {/* Row 5: Zone forecast */}
          <ChartCard
            title="Zone Waste Generation Forecast"
            description="Predicted daily waste output by category for selected zone"
          >
            <ZoneForecastChart />
          </ChartCard>

          {/* Bins predicted urgent */}
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
                          bin.hoursRemaining < 6 ? 'text-red-500' : bin.hoursRemaining < 12 ? 'text-orange-500' : ''
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
        </TabsContent>

        {/* ── Waste Pattern Prediction tab ──────────────────────────────── */}
        <TabsContent value="predictions" className="mt-6">
          <WastePatternPredictionTab
            zoneIds={zoneIds}
            zoneNamesMap={zoneNamesMap}
            fillPredictions={fillPredictions}
            candidateBins={candidateBins}
            allBinsData={allBinsData}
            binsLoading={binsLoading}
          />
        </TabsContent>

        {/* ── Anomaly Detection tab ─────────────────────────────────────── */}
        <TabsContent value="anomalies" className="mt-6">
          <AnomalyDetectionTab bins={allBinsData} isLoading={binsLoading} binsTotal={allBinsData.length} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
