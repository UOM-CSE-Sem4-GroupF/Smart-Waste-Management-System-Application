'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import { createClientApiClient } from '@/lib/api-client'
import {
  getWasteGenerationTrends,
  getZoneGenerationPrediction,
  type WasteGenerationTrend,
  type ZoneGenerationPrediction,
} from '@/lib/api/ml'
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
  // Prefer socket zone IDs; fall back to REST API zone IDs
  const zoneIds = useMemo(
    () => socketZoneIds.length > 0
      ? socketZoneIds
      : apiZones.map((z) => Number(z.zone_id)),
    [socketZoneIds, apiZones],
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

  // Zone names map — prefer socket store names, supplement with REST API
  const zoneNamesMap = useMemo(() => {
    const m: Record<string, string> = {}
    apiZones.forEach((z) => { m[`zone_${z.zone_id}`] = z.zone_name })
    zones.forEach((z, id) => { m[`zone_${id}`] = z.zone_name })
    return m
  }, [apiZones, zones])

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

  // Bins predicted to hit urgent — derive from store
  const urgentPredictions = useMemo(() => {
    const now = Date.now()
    return Array.from(bins.values())
      .filter((b) => b.predicted_full_at != null)
      .map((b) => ({
        ...b,
        hoursRemaining: (new Date(b.predicted_full_at!).getTime() - now) / 3_600_000,
      }))
      .filter((b) => b.hoursRemaining > 0 && b.hoursRemaining < 48)
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining)
      .slice(0, 25)
  }, [bins])

  // Collection efficiency + vehicle utilisation from job store
  const jobs     = useJobStore((s) => s.jobs)
  const jobsList = useMemo(() => Array.from(jobs.values()), [jobs])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Waste generation trends, collection efficiency and category breakdowns.</p>
      </div>

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

      {/* Row 2: Fill rate heatmap — requires hourly fill data not yet in API */}
      <ChartCard
        title="Fill Rate Heatmap"
        description="Average fill % by zone and hour of day"
      >
        <FillRateHeatmap data={[]} />
      </ChartCard>

      {/* Row 3: Collection efficiency + Vehicle utilisation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Collection Efficiency"
          description="Planned vs actual job duration across recent collections"
        >
          <CollectionEfficiencyChart jobs={jobsList} />
        </ChartCard>

        <ChartCard
          title="Vehicle Utilisation"
          description="Job load per vehicle — grey under-utilised, emerald optimal, orange over-utilised"
        >
          <VehicleUtilisationChart jobs={jobsList} />
        </ChartCard>
      </div>

      {/* Row 4: Zone forecast (full width) */}
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
    </div>
  )
}
