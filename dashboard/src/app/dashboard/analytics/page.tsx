'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useBinStore } from '@/store/binStore'
import { useJobStore } from '@/store/jobStore'
import { createClientApiClient } from '@/lib/api-client'
import { getWasteGenerationTrends } from '@/lib/api/ml'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const ZONE_COLOURS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#eab308', '#14b8a6']

export default function AnalyticsPage() {
  const { data: session } = useSession()

  // ── Zone fill trends (REST /api/v1/ml/trends/waste-generation) ────────────
  const { data: trendsRaw } = useQuery({
    queryKey: ['ml', 'waste-trends'],
    queryFn: () => getWasteGenerationTrends(
      createClientApiClient(session!.accessToken),
      { days: 7 },
    ) as Promise<unknown>,
    enabled: !!session?.accessToken,
    staleTime: 5 * 60_000,
  })

  // ── Zone stats from Zustand (populated via zone:stats socket events) ──────
  const zones = useBinStore((s) => s.zones)
  const bins  = useBinStore((s) => s.bins)

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

  // Format trends data for recharts (expects array of time-series rows keyed by zone)
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

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>

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
    </div>
  )
}
