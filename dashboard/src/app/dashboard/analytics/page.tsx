'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, subDays, subMonths, subQuarters, subYears, format } from 'date-fns'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import { createClientApiClient } from '@/lib/api-client'
import { getWasteGenerationTrends, getZoneForecast } from '@/lib/api/ml'
import { getJobStats } from '@/lib/api/jobs'
import dynamic from 'next/dynamic'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatCard } from '@/components/shared/StatCard'
import { Trash2, AlertTriangle, Truck, Activity } from 'lucide-react'

const FillRateHeatmap = dynamic(
  () => import('@/components/analytics/FillRateHeatmap').then((m) => m.FillRateHeatmap),
  { ssr: false, loading: () => <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div> },
)
const CollectionEfficiency = dynamic(
  () => import('@/components/analytics/CollectionEfficiency').then((m) => m.CollectionEfficiency),
  { ssr: false, loading: () => <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div> },
)
const VehicleUtilisation = dynamic(
  () => import('@/components/analytics/VehicleUtilisation').then((m) => m.VehicleUtilisation),
  { ssr: false, loading: () => <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div> },
)
const ZoneForecast = dynamic(
  () => import('@/components/analytics/ZoneForecast').then((m) => m.ZoneForecast),
  { ssr: false, loading: () => <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div> },
)

const ZONE_COLOURS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#eab308', '#14b8a6']

type Period = 'week' | 'month' | 'quarter' | 'year'

function periodDateRange(period: Period): { date_from: string; date_to: string } {
  const now  = new Date()
  const from = period === 'week'    ? subDays(now, 7)
             : period === 'month'   ? subMonths(now, 1)
             : period === 'quarter' ? subQuarters(now, 1)
             :                        subYears(now, 1)
  return {
    date_from: format(from, 'yyyy-MM-dd'),
    date_to:   format(now,  'yyyy-MM-dd'),
  }
}

const FORECAST_COLOURS: Record<string, string> = {
  general:    '#6b7280',
  organic:    '#22c55e',
  recyclable: '#3b82f6',
  hazardous:  '#ef4444',
}

export default function AnalyticsPage() {
  const { data: session } = useSession()

  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [period, setPeriod] = useState<Period>('week')

  const dateRange = useMemo(() => periodDateRange(period), [period])

  // ── Zone fill trends ─────────────────────────────────────────────────────
  const { data: trendsRaw } = useQuery({
    queryKey: ['ml', 'waste-trends', selectedZone, period],
    queryFn: () => getWasteGenerationTrends(
      createClientApiClient(session!.accessToken),
      {
        days:    period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365,
        ...(selectedZone !== 'all' && { zone_id: Number(selectedZone) }),
      },
    ) as Promise<unknown>,
    enabled: !!session?.accessToken,
    staleTime: 5 * 60_000,
  })

  // ── Job stats (efficiency + vehicle utilisation) ─────────────────────────
  const { data: statsRaw } = useQuery({
    queryKey: ['jobs', 'stats', selectedZone, period],
    queryFn: () => getJobStats(
      createClientApiClient(session!.accessToken),
      {
        ...dateRange,
        ...(selectedZone !== 'all' && { zone_id: Number(selectedZone) }),
      },
    ) as Promise<unknown>,
    enabled: !!session?.accessToken,
    staleTime: 5 * 60_000,
  })

  // ── Zone forecast ────────────────────────────────────────────────────────
  const { data: forecastRaw } = useQuery({
    queryKey: ['ml', 'zone-forecast', selectedZone],
    queryFn: () => getZoneForecast(
      createClientApiClient(session!.accessToken),
      { zone_id: Number(selectedZone), date_range: 'next_7_days' },
    ) as Promise<unknown>,
    enabled: !!session?.accessToken && selectedZone !== 'all',
    staleTime: 5 * 60_000,
  })

  // ── Zone stats from Zustand ──────────────────────────────────────────────
  const zones    = useMapStore((s) => s.zoneStats)
  const bins     = useMapStore((s) => s.bins)
  const vehicles = useMapStore((s) => s.vehicles)

  // ── Summary KPI stats ────────────────────────────────────────────────────
  const kpiStats = useMemo(() => {
    const binList = Array.from(bins.values()).filter(
      (b) => selectedZone === 'all' || String(b.zone_id) === selectedZone,
    )
    const criticalCount = binList.filter((b) => b.status === 'critical').length
    const urgentCount   = binList.filter((b) => b.status === 'urgent').length
    const avgFill       = binList.length > 0
      ? binList.reduce((s, b) => s + b.fill_level_pct, 0) / binList.length
      : 0
    return {
      totalBins:    binList.length,
      criticalCount,
      urgentCount,
      avgFill,
    }
  }, [bins, selectedZone])

  // Waste category bar chart
  const categoryData = useMemo(() => {
    const totals: Record<string, { count: number; total_kg: number }> = {}
    zones.forEach((z) => {
      if (selectedZone !== 'all' && String(z.zone_id) !== selectedZone) return
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
  }, [zones, selectedZone])

  // Bins predicted urgent
  const urgentPredictions = useMemo(() => {
    const now = Date.now()
    return Array.from(bins.values())
      .filter((b) => b.predicted_full_at != null)
      .filter((b) => selectedZone === 'all' || String(b.zone_id) === selectedZone)
      .map((b) => ({
        ...b,
        hoursRemaining: (new Date(b.predicted_full_at!).getTime() - now) / 3_600_000,
      }))
      .filter((b) => b.hoursRemaining > 0 && b.hoursRemaining < 48)
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining)
      .slice(0, 25)
  }, [bins, selectedZone])

  // Collection efficiency from job store
  const jobs = useJobStore((s) => s.jobs)
  const efficiencyData = useMemo(() => {
    const completedJobs = Array.from(jobs.values()).filter(
      (j) => j.state === 'COMPLETED' || j.state === 'AUDIT_RECORDED',
    )
    return completedJobs.slice(-10).map((j) => ({
      id:        j.job_id.slice(0, 6),
      planned:   j.total_bins ?? 0,
      collected: j.bins_collected ?? 0,
      skipped:   j.bins_skipped ?? 0,
    }))
  }, [jobs])

  // Format trends data for recharts
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

  const zoneIds = useMemo(() => Array.from(zones.keys()), [zones])

  // ── Fill rate heatmap data (aggregate by zone + hour from trends raw) ────
  const heatmapData = useMemo(() => {
    if (!trendsRaw || typeof trendsRaw !== 'object') return []
    const raw = trendsRaw as {
      series?: Array<{ timestamp: string; zone_id: number; avg_fill_pct: number }>
    }
    if (!Array.isArray(raw.series)) return []

    const acc: Record<string, { sum: number; count: number }> = {}
    raw.series.forEach((pt) => {
      const hour = new Date(pt.timestamp).getHours()
      const key  = `Zone ${pt.zone_id}:${hour}`
      const prev = acc[key] ?? { sum: 0, count: 0 }
      acc[key] = { sum: prev.sum + pt.avg_fill_pct, count: prev.count + 1 }
    })
    return Object.entries(acc).map(([key, { sum, count }]) => {
      const [zone, hourStr] = key.split(':')
      return { zone, hour: Number(hourStr), value: sum / count }
    })
  }, [trendsRaw])

  // ── Collection efficiency chart data from job stats REST ─────────────────
  const efficiencyChartData = useMemo(() => {
    if (!statsRaw || typeof statsRaw !== 'object') return []
    const raw = statsRaw as {
      daily?: Array<{
        date:             string
        planned_km?:      number
        actual_km?:       number
        on_time_pct?:     number
      }>
    }
    if (!Array.isArray(raw.daily)) return []
    return raw.daily.map((d) => ({
      label:        d.date,
      planned_km:   d.planned_km   ?? 0,
      actual_km:    d.actual_km    ?? 0,
      on_time_pct:  d.on_time_pct  ?? 0,
    }))
  }, [statsRaw])

  // ── Vehicle utilisation data from job stats REST ─────────────────────────
  const vehicleData = useMemo(() => {
    if (!statsRaw || typeof statsRaw !== 'object') return []
    const raw = statsRaw as {
      vehicles?: Array<{ vehicle_id: string; utilisation_pct: number }>
    }
    if (!Array.isArray(raw.vehicles)) return []
    return raw.vehicles.map((v) => ({
      vehicle_id:  v.vehicle_id,
      utilisation: v.utilisation_pct,
    }))
  }, [statsRaw])

  // ── Zone forecast AreaChart data ─────────────────────────────────────────
  const { forecastPoints, forecastCategories } = useMemo(() => {
    if (!forecastRaw || typeof forecastRaw !== 'object') {
      return { forecastPoints: [], forecastCategories: [] }
    }
    const raw = forecastRaw as {
      forecast?: Array<{ date: string; [cat: string]: string | number }>
    }
    if (!Array.isArray(raw.forecast) || raw.forecast.length === 0) {
      return { forecastPoints: [], forecastCategories: [] }
    }
    const sample    = raw.forecast[0]
    const catKeys   = Object.keys(sample).filter((k) => k !== 'date')
    const categories = catKeys.map((k) => ({
      key:    k,
      label:  k.charAt(0).toUpperCase() + k.slice(1),
      colour: FORECAST_COLOURS[k] ?? '#94a3b8',
    }))
    return { forecastPoints: raw.forecast, forecastCategories: categories }
  }, [forecastRaw])

  // Zone selector options
  const zoneOptions = useMemo(
    () => Array.from(zones.entries()).map(([id, z]) => ({ id: String(id), name: z.zone_name })),
    [zones],
  )

  return (
    <div className="space-y-8 p-6">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>

        <div className="flex gap-3">
          {/* Zone selector */}
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {zoneOptions.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period picker */}
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last week</SelectItem>
              <SelectItem value="month">Last month</SelectItem>
              <SelectItem value="quarter">Last quarter</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Bins Monitored"
          value={kpiStats.totalBins}
          sublabel={selectedZone === 'all' ? 'all zones' : 'selected zone'}
          icon={<Trash2 className="h-5 w-5" />}
        />
        <StatCard
          label="Critical Bins"
          value={kpiStats.criticalCount}
          sublabel="require immediate collection"
          urgent={kpiStats.criticalCount > 0}
          trend={kpiStats.criticalCount > 0 ? 'down' : 'neutral'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Urgent Bins"
          value={kpiStats.urgentCount}
          sublabel="fill level above threshold"
          urgent={kpiStats.urgentCount > 5}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="Active Vehicles"
          value={vehicles.size}
          sublabel="live GPS positions"
          icon={<Truck className="h-5 w-5" />}
        />
      </div>

      {/* Chart 1 — Zone fill level over time */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Zone Fill Level — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendsData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No trend data yet — zone:stats events will populate this.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendsData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {zoneIds.map((zid, i) => (
                  <Line
                    key={zid}
                    type="monotone"
                    dataKey={`zone_${zid}`}
                    name={zones.get(zid)?.zone_name ?? `Zone ${zid}`}
                    stroke={ZONE_COLOURS[i % ZONE_COLOURS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Chart 2 — Waste category breakdown */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Waste Category Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Waiting for live zone:stats data…
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="bins"  name="Bins"       fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="kg"    name="Weight (kg)" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table — bins predicted urgent soon */}
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

      {/* Chart 3 — Collection efficiency */}
      {efficiencyData.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collection Efficiency — Recent Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={efficiencyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="planned"   name="Planned"   fill="#6b7280" radius={[4,4,0,0]} stackId="a" />
                <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[4,4,0,0]} stackId="b" />
                <Bar dataKey="skipped"   name="Skipped"   fill="#f97316" radius={[4,4,0,0]} stackId="b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Chart 3b — Fill rate heatmap */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Fill Rate Heatmap — Zones × Hour of Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FillRateHeatmap data={heatmapData} />
        </CardContent>
      </Card>

      {/* Chart 4 — Collection efficiency (REST-based) */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Collection Efficiency — Planned vs Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CollectionEfficiency data={efficiencyChartData} />
        </CardContent>
      </Card>

      {/* Chart 5 — Vehicle utilisation */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Vehicle Utilisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleUtilisation data={vehicleData} />
        </CardContent>
      </Card>

      {/* Chart 6 — 7-day forecast (only shown when a zone is selected) */}
      {selectedZone !== 'all' && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              7-Day Waste Generation Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ZoneForecast data={forecastPoints} categories={forecastCategories} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
