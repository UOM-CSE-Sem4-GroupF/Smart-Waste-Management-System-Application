'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer,
} from 'recharts'
import { createClientApiClient } from '@/lib/api-client'
import {
  getWasteGenerationTrends,
  getZoneGenerationPrediction,
  type WasteGenerationTrend,
  type ZoneGenerationPrediction,
  type FillTimePrediction,
} from '@/lib/api/ml'
import type { Bin } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ChartCard } from './ChartCard'
import { ZoneFillTrendsChart } from './ZoneFillTrendsChart'
import { ZoneSelector } from '@/components/shared/ZoneSelector'
import { ChartSkeleton } from './ChartSkeleton'

const CATEGORY_COLORS: Record<string, string> = {
  food_waste: '#22c55e',
  paper:      '#3b82f6',
  plastic:    '#f97316',
  glass:      '#06b6d4',
  general:    '#6b7280',
  e_waste:    '#ec4899',
}

type Period = 'week' | 'month' | 'quarter'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week',    label: '7 Days'  },
  { value: 'month',   label: '30 Days' },
  { value: 'quarter', label: '90 Days' },
]

interface WastePatternPredictionTabProps {
  zoneIds:          number[]
  zoneNamesMap:     Record<string, string>
  fillPredictions?: PromiseSettledResult<FillTimePrediction>[]
  candidateBins:    Bin[]
  allBinsData:      Bin[]
  binsLoading:      boolean
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function fillColor(pct: number) {
  if (pct >= 90) return 'text-red-500'
  if (pct >= 75) return 'text-orange-500'
  return ''
}

function hoursColor(h: number) {
  if (h < 6)  return 'text-red-500'
  if (h < 12) return 'text-orange-500'
  return ''
}

export function WastePatternPredictionTab({
  zoneIds,
  zoneNamesMap,
  fillPredictions,
  candidateBins,
  allBinsData,
  binsLoading,
}: WastePatternPredictionTabProps) {
  const { data: session } = useSession()

  const [period, setPeriod] = useState<Period>('week')
  const [selectedZone, setSelectedZone] = useState<number | 'all'>(zoneIds[0] ?? 1)

  const { data: trendsRaw, isFetching: trendsFetching } = useQuery({
    queryKey: ['ml', 'waste-trends', zoneIds, period],
    queryFn: async () => {
      const api = createClientApiClient(session!.accessToken)
      return Promise.all(zoneIds.map((id) => getWasteGenerationTrends(api, { zone_id: id, period })))
    },
    enabled:   !!session?.accessToken && zoneIds.length > 0,
    staleTime: 5 * 60_000,
    retry:     false,
  })

  const { data: zonePrediction, isPending: forecastPending, isError: forecastError } = useQuery({
    queryKey: ['ml', 'zone-forecast', selectedZone],
    queryFn: () => getZoneGenerationPrediction(
      createClientApiClient(session!.accessToken),
      selectedZone as number,
    ),
    enabled:   !!session?.accessToken && selectedZone !== 'all',
    staleTime: 15 * 60_000,
    retry:     false,
  })

  const trendChartData = useMemo(() => {
    if (!trendsRaw?.length) return []
    const first = trendsRaw[0] as WasteGenerationTrend
    if (!first?.series?.length) return []
    return first.series.map((_, i) => {
      const row: { date: string; [k: string]: number | string } = { date: first.series[i].label }
      trendsRaw.forEach((z) => {
        const pt = (z as WasteGenerationTrend).series[i]
        if (!pt) return
        const { label: _label, ...cats } = pt
        const total = Object.values(cats).reduce((sum, v) => sum + (v as number), 0)
        row[`zone_${(z as WasteGenerationTrend).zone_id}`] = parseFloat(total.toFixed(1))
      })
      return row
    })
  }, [trendsRaw])

  const forecastChartData = useMemo(() => {
    if (!zonePrediction) return []
    return Object.entries((zonePrediction as ZoneGenerationPrediction).by_waste_category).map(([cat, kg]) => ({
      name: cat.replace(/_/g, ' '),
      kg:   parseFloat((kg as number).toFixed(1)),
      key:  cat,
    }))
  }, [zonePrediction])

  const latestTotalKg = useMemo(() => {
    if (!trendsRaw?.length) return null
    const first = trendsRaw[0] as WasteGenerationTrend
    const lastIdx = first.series.length - 1
    if (lastIdx < 0) return null
    return trendsRaw.reduce((sum, z) => {
      const pt = (z as WasteGenerationTrend).series[lastIdx]
      if (!pt) return sum
      const { label: _label, ...cats } = pt
      return sum + Object.values(cats).reduce((s, v) => s + (v as number), 0)
    }, 0)
  }, [trendsRaw])

  const predMap = useMemo(() => {
    const m = new Map<string, FillTimePrediction>()
    fillPredictions?.forEach((result, i) => {
      if (result.status === 'fulfilled') m.set(candidateBins[i].bin_id, result.value)
    })
    return m
  }, [fillPredictions, candidateBins])

  const now = Date.now()
  const fillRows = useMemo(() => {
    return allBinsData
      .flatMap((b) => {
        const pred = predMap.get(b.bin_id)
        if (!pred) return []
        return [{ ...b, prediction: pred, hoursRemaining: (new Date(pred.predicted_full_at).getTime() - now) / 3_600_000 }]
      })
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining)
  }, [allBinsData, predMap, now])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <StatCard
          label="Zones Monitored"
          value={zoneIds.length}
          sub="active zones"
        />
        <StatCard
          label="Est. Waste (Latest Period)"
          value={latestTotalKg != null ? `${latestTotalKg.toFixed(0)} kg` : '—'}
          sub="all zones combined"
        />
        <StatCard
          label="Bins with Predictions"
          value={fillRows.length}
          sub={`of ${allBinsData.length} total bins`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Zone Generation Forecast — Next 7 Days"
          description="Predicted daily kg by waste category"
          action={<ZoneSelector value={selectedZone} onChange={setSelectedZone} showAll={false} />}
        >
          {forecastPending ? (
            <ChartSkeleton height="h-56" />
          ) : forecastError ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Forecast endpoint not yet available
            </div>
          ) : forecastChartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              No forecast data for selected zone
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Predicted{' '}
                <span className="font-semibold text-foreground">
                  {(zonePrediction as ZoneGenerationPrediction).predicted_kg_per_day.toFixed(0)} kg/day
                </span>{' '}
                · model{' '}
                <span className="font-mono text-xs">
                  {(zonePrediction as ZoneGenerationPrediction).model_version}
                </span>
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={forecastChartData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `${v} kg`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={66} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((v: number) => [`${v} kg`, 'Predicted']) as any}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="kg" radius={[0, 4, 4, 0]}>
                    {forecastChartData.map((entry) => (
                      <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Historical Waste Generation"
          description="Total kg per zone over selected period"
          action={
            <div className="flex gap-1">
              {PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors
                    ${period === value
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <ZoneFillTrendsChart
            data={trendChartData}
            zoneNames={zoneNamesMap}
            isLoading={trendsFetching}
            unit=" kg"
          />
        </ChartCard>
      </div>

      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Bin Fill-Time Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {binsLoading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground animate-pulse">
              Loading predictions…
            </p>
          ) : fillRows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No fill-time predictions available — bins may be below 30% fill level.
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
                  <TableHead>Confidence Range</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fillRows.map((bin) => (
                  <TableRow key={bin.bin_id} className="hover:bg-accent/50">
                    <TableCell className="font-mono text-xs font-medium">{bin.bin_id}</TableCell>
                    <TableCell className="text-xs">
                      {bin.zone_name || `Zone ${bin.zone_id}`}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${fillColor(bin.fill_level_pct)}`}>
                      {bin.fill_level_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDistanceToNow(new Date(bin.prediction.predicted_full_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${hoursColor(bin.hoursRemaining)}`}>
                      {bin.hoursRemaining > 0 ? `${bin.hoursRemaining.toFixed(1)} h` : 'Overdue'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {bin.prediction.confidence_interval.lower_hours.toFixed(0)}–
                      {bin.prediction.confidence_interval.upper_hours.toFixed(0)} h
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
