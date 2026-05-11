'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
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

export default function AnalyticsPage() {
  const { data: session } = useSession()

  // ── Zone fill trends (REST /api/v1/ml/trends/waste-generation) ────────────
  const { data: trendsRaw } = useQuery({
    queryKey: ['ml', 'waste-trends'],
    queryFn: () => getWasteGenerationTrends(
      createClientApiClient(session?.accessToken),
      { days: 7 },
    ) as Promise<unknown>,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // ── Zone stats from Zustand (populated via zone:stats socket events) ──────
  const zones = useMapStore((s) => s.zoneStats)
  const bins  = useMapStore((s) => s.bins)

  // Waste category bar chart — sum totals across all zones
  const categoryData = useMemo(() => {
    const totals: Record<string, { count: number; total_kg: number }> = {}
    zones.forEach((z) => {
      Object.entries(z.category_breakdown).forEach(([cat, v]) => {
        const existing = totals[cat] ?? { count: 0, total_kg: 0 }
        totals[cat] = {
          count:    existing.count    + v.count,
          total_kg: existing.total_kg + v.total_kg,
        }
      })
    })
    return Object.entries(totals).map(([name, v]) => ({
      name:  name.replace(/_/g, ' '),
      bins:  v.count,
      kg:    parseFloat(v.total_kg.toFixed(1)),
    }))
  }, [zones])

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

  // Collection efficiency from job store — derive from jobs list (no stats endpoint yet)
  const jobs = useJobStore((s) => s.jobs)
  const jobsList = useMemo(() => Array.from(jobs.values()), [jobs])

  // Heatmap: group trendsRaw series by zone + hour
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

  // Zone names map for fill trends chart
  const zoneNamesMap = useMemo(() => {
    const m: Record<string, string> = {}
    zones.forEach((z) => { m[`zone_${z.zone_id}`] = z.zone_name })
    return m
  }, [zones])

  // Reshape trendsRaw into flat time-series rows keyed by zone (for ZoneFillTrendsChart)
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
        <p className="text-sm text-muted-foreground mt-1">Fill trends, collection efficiency and waste category breakdowns.</p>
      </div>

      {/* Row 1: Fill trends + Waste categories */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Zone Fill Level — Last 7 Days"
          description="Average fill % per zone from trend data"
        >
          <ZoneFillTrendsChart
            data={trendsData}
            zoneNames={zoneNamesMap}
            isLoading={false}
          />
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
        title="7-Day Zone Forecast"
        description="Predicted fill level for next 7 days with confidence intervals"
      >
        <ZoneForecastChart />
      </ChartCard>

      {/* Bins predicted urgent — keeps existing table */}
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
