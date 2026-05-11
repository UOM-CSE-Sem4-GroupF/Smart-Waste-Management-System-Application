'use client'

import { Suspense, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useBins } from '@/hooks/useBins'
import { useMapStore } from '@/store/mapStore'
import { BinStatusBadge } from '@/components/bins/BinStatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import type { BinStatus } from '@/types'

const STATUS_OPTIONS: BinStatus[] = ['normal', 'monitor', 'urgent', 'critical', 'offline']
const WASTE_CATEGORIES = ['food_waste', 'paper', 'glass', 'plastic', 'general', 'e_waste']
const PAGE_SIZE = 25

function BinsContent() {
  const router     = useRouter()
  const pathname   = usePathname()
  const params     = useSearchParams()
  const [,startTransition] = useTransition()

  const zoneId    = params.get('zone_id')   ? Number(params.get('zone_id'))   : undefined
  const status    = params.get('status')    ?? undefined
  const category  = params.get('category')  ?? undefined
  const page      = params.get('page')      ? Number(params.get('page'))      : 1

  // Remote query for full list (pagination + filters)
  const { data, isLoading } = useBins({
    zone_id:        zoneId,
    status,
    waste_category: category,
    page,
    limit:          PAGE_SIZE,
  })

  // Live bin store — apply live updates to matching rows
  const liveBins = useMapStore((s) => s.bins)

  // Merge REST data with live store updates
  const rows = useMemo(() => {
    if (!data?.data) return []
    return data.data.map((bin) => {
      const live = liveBins.get(bin.bin_id)
      if (!live) return bin
      return { ...bin, status: live.status, fill_level_pct: live.fill_level_pct, urgency_score: live.urgency_score }
    })
  }, [data, liveBins])

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params.toString())
    if (value && value !== 'all') {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page') // reset pagination on filter change
    startTransition(() => router.push(`${pathname}?${next.toString()}`))
  }

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Bin Status</h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status ?? 'all'}
          onValueChange={(v) => setParam('status', v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={category ?? 'all'}
          onValueChange={(v) => setParam('category', v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {WASTE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(status || category) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams()
              startTransition(() => router.push(pathname))
            }}
          >
            Clear filters
          </Button>
        )}

        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {data.total} bins
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bin ID</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Cluster</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fill %</TableHead>
              <TableHead className="text-right">Urgency</TableHead>
              <TableHead className="text-right">Est. Weight</TableHead>
              <TableHead>Waste Type</TableHead>
              <TableHead>Last Reading</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((bin) => (
                  <TableRow key={bin.bin_id} className="hover:bg-accent/50">
                    <TableCell>
                      <Link
                        href={`/dashboard/bins/${bin.bin_id}`}
                        className="font-medium text-green-600 hover:underline dark:text-green-400"
                      >
                        {bin.bin_id}
                      </Link>
                    </TableCell>
                    <TableCell>{bin.zone_name}</TableCell>
                    <TableCell>{bin.cluster_name}</TableCell>
                    <TableCell>
                      <BinStatusBadge status={bin.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {bin.fill_level_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {bin.urgency_score.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {bin.estimated_weight_kg.toFixed(1)} kg
                    </TableCell>
                    <TableCell className="capitalize">
                      {bin.waste_category.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(bin.last_reading_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setParam('page', String(page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

export default function BinsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading bins…</div>}>
      <BinsContent />
    </Suspense>
  )
}
