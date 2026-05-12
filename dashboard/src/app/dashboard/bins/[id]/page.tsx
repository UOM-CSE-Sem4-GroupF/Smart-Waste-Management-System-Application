import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { createApiClient } from '@/lib/api-client'
import { getBin, getBinHistory } from '@/lib/api/bins'
import { BinStatusBadge } from '@/components/bins/BinStatusBadge'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FillHistoryChart } from './_components/FillHistoryChart'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BinDetailPage({ params }: Props) {
  const { id } = await params

  const api = await createApiClient()
  const [binResult, historyResult] = await Promise.allSettled([
    getBin(api, id),
    getBinHistory(api, id),
  ])

  if (binResult.status === 'rejected') notFound()
  const bin = binResult.value
  const history = historyResult.status === 'fulfilled' ? historyResult.value : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{bin.bin_id}</h2>
            <BinStatusBadge status={bin.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {bin.zone_name} · {bin.cluster_name} · Last reading{' '}
            {formatDistanceToNow(new Date(bin.last_reading_at), { addSuffix: true })}
          </p>
        </div>
        <Link
          href="/dashboard/bins"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to all bins
        </Link>
      </div>

      {/* Row 1 — Current state cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Fill Level"     value={`${(bin.fill_level_pct ?? 0).toFixed(1)}%`} />
        <StatCard label="Urgency Score"  value={(bin.urgency_score ?? 0).toFixed(0)}
          urgent={(bin.urgency_score ?? 0) > 80} />
        <StatCard label="Est. Weight"    value={`${(bin.estimated_weight_kg ?? 0).toFixed(1)} kg`} />
        <StatCard label="Battery"        value={`${(bin.battery_level_pct ?? 0).toFixed(0)}%`}
          urgent={(bin.battery_level_pct ?? 100) < 20} />
        <StatCard
          label="Predicted Full"
          value={bin.predicted_full_at
            ? formatDistanceToNow(new Date(bin.predicted_full_at), { addSuffix: true })
            : 'N/A'}
        />
        <StatCard
          label="Waste Category"
          value={bin.waste_category.replace(/_/g, ' ')}
          sublabel={`Colour: ${bin.waste_category_colour}`}
        />
      </div>

      {/* Row 2 — Fill history chart */}
      {history && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fill Level — last 24 h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FillHistoryChart history={history} />
          </CardContent>
        </Card>
      )}

      {/* Row 3 — Recent collections */}
      {bin.recent_collections && bin.recent_collections.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Fill at collection</TableHead>
                  <TableHead className="text-right">Weight collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bin.recent_collections.map((c) => (
                  <TableRow key={c.job_id}>
                    <TableCell className="text-xs">
                      {format(new Date(c.collected_at), 'dd MMM HH:mm')}
                    </TableCell>
                    <TableCell>{c.driver_id}</TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/jobs/${c.job_id}`}
                        className="text-xs text-green-600 hover:underline dark:text-green-400"
                      >
                        {c.job_id.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{c.job_type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.fill_level_at_collection.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.actual_weight_kg != null ? `${c.actual_weight_kg.toFixed(1)} kg` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
