'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { Plus, Search, Pencil, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { createClientApiClient } from '@/lib/api-client'
import { BinFormDialog } from './BinFormDialog'
import type { BinUpdatePayload } from '@/types'

const STATUSES  = ['', 'normal', 'monitor', 'urgent', 'critical', 'offline']
const CATS      = ['', 'food_waste', 'recyclable', 'general', 'hazardous', 'green_waste']
const STATUS_DOT: Record<string, string> = {
  normal:   'bg-bin-normal',
  monitor:  'bg-bin-monitor',
  urgent:   'bg-bin-urgent',
  critical: 'bg-bin-critical',
  offline:  'bg-bin-offline',
}

interface BinListResponse { data: BinUpdatePayload[]; total: number; page: number; totalPages: number }

interface Props {
  zoneOptions: Array<{ id: number; name: string }>
}

export function BinsTab({ zoneOptions }: Props) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const [search,     setSearch]     = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [page,       setPage]       = useState(1)
  const [editBin,    setEditBin]    = useState<Partial<BinUpdatePayload> | null>(null)
  const [addOpen,    setAddOpen]    = useState(false)
  const [deactivate, setDeactivate] = useState<string | null>(null)

  const { data, isLoading } = useQuery<BinListResponse>({
    queryKey: ['bins', search, zoneFilter, statusFilter, catFilter, page],
    queryFn: () => {
      const api = createClientApiClient(session!.accessToken)
      return api.get('api/v1/bins', {
        searchParams: {
          ...(search       ? { search }          : {}),
          ...(zoneFilter   ? { zone_id: zoneFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(catFilter    ? { category: catFilter }  : {}),
          limit: 25,
          offset: (page - 1) * 25,
        } as Record<string, string | number>,
      }).json<BinListResponse>()
    },
    enabled: !!session,
  })

  const { mutate: doDeactivate, isPending: deactivating } = useMutation({
    mutationFn: (binId: string) => {
      const api = createClientApiClient(session!.accessToken)
      return api.patch(`api/v1/bins/${binId}`, { json: { active: false } }).json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] })
      setDeactivate(null)
    },
  })

  const bins   = data?.data ?? []
  const total  = data?.total ?? 0
  const pages  = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Bin ID or address…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={zoneFilter} onValueChange={(v) => { setZoneFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            {zoneOptions.map((z) => (
              <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUSES.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {CATS.filter(Boolean).map((c) => (
              <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setAddOpen(true)} size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> Add New Bin
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {['ID', 'Address', 'Zone', 'Status', 'Fill %', 'Category', 'Battery', 'Last Seen', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-3 py-2.5"><div className="h-4 bg-muted rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : bins.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No bins found.</td></tr>
            ) : (
              bins.map((bin) => (
                <tr key={bin.bin_id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs">{bin.bin_id}</td>
                  <td className="px-3 py-2.5 max-w-40 truncate">{bin.address}</td>
                  <td className="px-3 py-2.5">{zoneOptions.find((z) => z.id === bin.zone_id)?.name ?? bin.zone_id}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[bin.status] ?? 'bg-muted'}`} />
                      {bin.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{bin.fill_level_pct?.toFixed(0) ?? '—'}%</td>
                  <td className="px-3 py-2.5">{bin.waste_category?.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2.5">{bin.battery_pct != null ? `${bin.battery_pct}%` : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {bin.last_seen_at ? formatDistanceToNow(new Date(bin.last_seen_at), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditBin(bin)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeactivate(bin.bin_id)}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {Math.min((page - 1) * 25 + 1, total)}–{Math.min(page * 25, total)} of {total}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
        </div>
      </div>

      {/* Add/Edit dialog */}
      <BinFormDialog
        open={addOpen || editBin !== null}
        onClose={() => { setAddOpen(false); setEditBin(null) }}
        bin={editBin ?? undefined}
        zoneOptions={zoneOptions}
      />

      {/* Deactivate confirm */}
      <AlertDialog open={deactivate !== null} onOpenChange={(v) => { if (!v) setDeactivate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivate}?</AlertDialogTitle>
            <AlertDialogDescription>
              This bin will stop reporting and be excluded from job planning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={deactivating}
              onClick={() => deactivate && doDeactivate(deactivate)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
