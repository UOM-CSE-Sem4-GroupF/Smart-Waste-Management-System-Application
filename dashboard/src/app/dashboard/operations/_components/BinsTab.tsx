'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { Boxes, MapPinned, Pencil, Plus, PowerOff, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { createClientApiClient } from '@/lib/api-client'
import {
  createBin,
  createCluster,
  createZone,
  listBins,
  listClusters,
  listWasteCategories,
  listZones,
  updateBin,
  updateCluster,
  updateZone,
  type CoreCluster,
  type HierarchyBin,
  type ZoneOption,
} from '@/lib/api/metadata'
import { BinFormDialog, type BinFormValues } from './BinFormDialog'
import { ClusterFormDialog, type ClusterFormValues } from './ClusterFormDialog'
import { ZoneFormDialog, type ZoneFormValues } from './ZoneFormDialog'

const STATUS_DOT: Record<string, string> = {
  normal: 'bg-bin-normal',
  monitor: 'bg-bin-monitor',
  urgent: 'bg-bin-urgent',
  critical: 'bg-bin-critical',
  offline: 'bg-bin-offline',
}

const emptyZone: ZoneFormValues = {
  name: '',
  code: '',
  collection_day: '',
  collection_time: '',
  notes: '',
}

const emptyCluster = (zoneId = 0): ClusterFormValues => ({
  id: '',
  zone_id: zoneId,
  name: '',
  lat: 0,
  lng: 0,
  address: '',
  cluster_type: 'public_space',
  notes: '',
})

interface Props {
  zoneOptions: ZoneOption[]
}

function clean<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  ) as Partial<T>
}

export function BinsTab({ zoneOptions }: Props) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const api = useMemo(() => createClientApiClient(session?.accessToken), [session?.accessToken])

  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(zoneOptions[0]?.id ?? null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [zoneDialogOpen, setZoneDialogOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<ZoneOption | null>(null)
  const [zoneForm, setZoneForm] = useState<ZoneFormValues>(emptyZone)

  const [clusterDialogOpen, setClusterDialogOpen] = useState(false)
  const [editingCluster, setEditingCluster] = useState<CoreCluster | null>(null)
  const [clusterForm, setClusterForm] = useState<ClusterFormValues>(emptyCluster(selectedZoneId ?? 0))

  const [binDialogOpen, setBinDialogOpen] = useState(false)
  const [editingBin, setEditingBin] = useState<HierarchyBin | null>(null)
  const [deactivate, setDeactivate] = useState<{ type: 'zone' | 'cluster' | 'bin'; id: string; name: string } | null>(null)

  const zonesQuery = useQuery({
    queryKey: ['metadata', 'zones'],
    queryFn: () => listZones(api),
    placeholderData: zoneOptions,
  })

  const zones = zonesQuery.data ?? []
  const activeZoneId = selectedZoneId ?? zones[0]?.id ?? null

  const clustersQuery = useQuery({
    queryKey: ['metadata', 'clusters', activeZoneId],
    queryFn: () => listClusters(api, activeZoneId ?? undefined),
  })

  const clusters = clustersQuery.data ?? []
  const activeClusterId = selectedClusterId && clusters.some((cluster) => cluster.id === selectedClusterId)
    ? selectedClusterId
    : null

  const binsQuery = useQuery({
    queryKey: ['metadata', 'bins', activeZoneId, activeClusterId, page],
    queryFn: () => listBins(api, {
      zoneId: activeZoneId ?? undefined,
      clusterId: activeClusterId ?? undefined,
      page,
      limit: 25,
    }),
  })

  const categoriesQuery = useQuery({
    queryKey: ['metadata', 'waste-categories'],
    queryFn: () => listWasteCategories(api),
  })

  const filteredBins = useMemo(() => {
    const term = search.trim().toLowerCase()
    const bins = binsQuery.data?.data ?? []
    if (!term) return bins
    return bins.filter((bin) => (
      bin.bin_id.toLowerCase().includes(term) ||
      bin.address.toLowerCase().includes(term) ||
      bin.cluster_name.toLowerCase().includes(term) ||
      bin.waste_category.toLowerCase().includes(term)
    ))
  }, [binsQuery.data?.data, search])

  const invalidateHierarchy = () => {
    queryClient.invalidateQueries({ queryKey: ['metadata'] })
    queryClient.invalidateQueries({ queryKey: ['bins'] })
    queryClient.invalidateQueries({ queryKey: ['zones'] })
  }

  const zoneMutation = useMutation({
    mutationFn: async () => {
      if (!zoneForm.name.trim() || !zoneForm.code.trim()) throw new Error('Zone name and code are required.')
      if (editingZone) {
        await updateZone(api, editingZone.id, clean(zoneForm))
        return editingZone
      }
      return createZone(api, clean(zoneForm) as ZoneFormValues)
    },
    onSuccess: (zone) => {
      invalidateHierarchy()
      setSelectedZoneId(zone.id)
      setZoneDialogOpen(false)
      setEditingZone(null)
      setZoneForm(emptyZone)
    },
  })

  const clusterMutation = useMutation({
    mutationFn: async () => {
      if (!clusterForm.id.trim() || !clusterForm.name.trim() || !clusterForm.zone_id) {
        throw new Error('Cluster ID, name, and zone are required.')
      }
      if (editingCluster) {
        await updateCluster(api, editingCluster.id, clean(clusterForm))
        return editingCluster
      }
      return createCluster(api, clean(clusterForm) as ClusterFormValues)
    },
    onSuccess: (cluster) => {
      invalidateHierarchy()
      setSelectedZoneId(Number(cluster.zone_id))
      setSelectedClusterId(cluster.id)
      setClusterDialogOpen(false)
      setEditingCluster(null)
      setClusterForm(emptyCluster(activeZoneId ?? 0))
    },
  })

  const binMutation = useMutation({
    mutationFn: async ({ values, inline }: {
      values: BinFormValues
      inline: { zone?: ZoneFormValues; cluster?: ClusterFormValues }
    }) => {
      let zoneId = values.zone_id
      if (inline.zone) {
        if (!inline.zone.name.trim() || !inline.zone.code.trim()) throw new Error('New zone name and code are required.')
        const zone = await createZone(api, clean(inline.zone) as ZoneFormValues)
        zoneId = zone.id
      }

      let clusterId = values.cluster_id
      if (values.cluster_mode === 'new') {
        if (!inline.cluster?.id.trim() || !inline.cluster.name.trim()) {
          throw new Error('New cluster ID and name are required.')
        }
        const cluster = await createCluster(api, clean({ ...inline.cluster, zone_id: zoneId }) as ClusterFormValues)
        clusterId = cluster.id
      }
      if (!clusterId) throw new Error('Select or create a cluster before saving the bin.')

      const payload = clean({
        id: values.id,
        cluster_id: clusterId,
        waste_category_id: values.waste_category_id,
        volume_litres: values.volume_litres,
        lat: values.lat,
        lng: values.lng,
        address: values.address,
        depth_cm: values.depth_cm,
        notes: values.notes,
      })

      if (editingBin) {
        await updateBin(api, editingBin.bin_id, payload)
        return { zoneId, clusterId }
      }

      await createBin(api, payload as Parameters<typeof createBin>[1])
      return { zoneId, clusterId }
    },
    onSuccess: ({ zoneId, clusterId }) => {
      invalidateHierarchy()
      setSelectedZoneId(zoneId)
      setSelectedClusterId(clusterId)
      setBinDialogOpen(false)
      setEditingBin(null)
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (!deactivate) return
      if (deactivate.type === 'zone') return updateZone(api, Number(deactivate.id), { active: false })
      if (deactivate.type === 'cluster') return updateCluster(api, deactivate.id, { active: false })
      return updateBin(api, deactivate.id, { active: false })
    },
    onSuccess: () => {
      invalidateHierarchy()
      setDeactivate(null)
    },
  })

  const currentZone = zones.find((zone) => zone.id === activeZoneId)
  const currentCluster = clusters.find((cluster) => cluster.id === activeClusterId)
  const pages = binsQuery.data?.pages ?? 1
  const total = binsQuery.data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[280px_320px_minmax(0,1fr)]">
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPinned className="h-4 w-4 text-muted-foreground" />
              Zones
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setEditingZone(null)
                setZoneForm(emptyZone)
                setZoneDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[460px] space-y-1 overflow-y-auto p-2">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  zone.id === activeZoneId ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
                }`}
                onClick={() => {
                  setSelectedZoneId(zone.id)
                  setSelectedClusterId(null)
                  setPage(1)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{zone.name}</span>
                  <Badge variant={zone.active === false ? 'outline' : 'secondary'}>{zone.code ?? zone.id}</Badge>
                </div>
              </button>
            ))}
          </div>
          {currentZone && (
            <div className="flex gap-2 border-t p-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditingZone(currentZone)
                  setZoneForm({
                    name: currentZone.name,
                    code: currentZone.code ?? `ZONE-${currentZone.id}`,
                    collection_day: '',
                    collection_time: '',
                    notes: '',
                  })
                  setZoneDialogOpen(true)
                }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeactivate({ type: 'zone', id: String(currentZone.id), name: currentZone.name })}
              >
                <PowerOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              Clusters
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={!activeZoneId}
              onClick={() => {
                setEditingCluster(null)
                setClusterForm(emptyCluster(activeZoneId ?? 0))
                setClusterDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[460px] space-y-1 overflow-y-auto p-2">
            {clustersQuery.isLoading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading clusters...</p>
            ) : clusters.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No clusters in this zone.</p>
            ) : clusters.map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  cluster.id === activeClusterId ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
                }`}
                onClick={() => {
                  setSelectedClusterId(cluster.id)
                  setPage(1)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{cluster.name}</span>
                  <Badge variant={cluster.active === false ? 'outline' : 'secondary'}>{cluster.bins?.length ?? 0} bins</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{cluster.id}</p>
              </button>
            ))}
          </div>
          {currentCluster && (
            <div className="flex gap-2 border-t p-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditingCluster(currentCluster)
                  setClusterForm({
                    id: currentCluster.id,
                    zone_id: Number(currentCluster.zone_id),
                    name: currentCluster.name,
                    lat: Number(currentCluster.lat ?? 0),
                    lng: Number(currentCluster.lng ?? 0),
                    address: currentCluster.address ?? '',
                    cluster_type: currentCluster.cluster_type ?? '',
                    notes: '',
                  })
                  setClusterDialogOpen(true)
                }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeactivate({ type: 'cluster', id: currentCluster.id, name: currentCluster.name })}
              >
                <PowerOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search bins, clusters, categories..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingBin(null)
                setBinDialogOpen(true)
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add Bin
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {['ID', 'Cluster', 'Status', 'Fill', 'Category', 'Battery', 'Last Seen', 'Actions'].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-left font-medium text-muted-foreground">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {binsQuery.isLoading ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Loading bins...</td></tr>
                ) : filteredBins.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No bins found.</td></tr>
                ) : filteredBins.map((bin) => (
                  <tr key={bin.bin_id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs">{bin.bin_id}</div>
                      <div className="max-w-44 truncate text-xs text-muted-foreground">{bin.address || 'No address'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{bin.cluster_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{bin.cluster_id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[bin.status] ?? 'bg-muted'}`} />
                        {bin.active ? bin.status : 'inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{bin.fill_level_pct != null ? `${bin.fill_level_pct.toFixed(0)}%` : '-'}</td>
                    <td className="px-3 py-2.5">{bin.waste_category.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5">{bin.battery_level_pct != null ? `${bin.battery_level_pct.toFixed(0)}%` : '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {bin.last_reading_at ? formatDistanceToNow(new Date(bin.last_reading_at), { addSuffix: true }) : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingBin(bin); setBinDialogOpen(true) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeactivate({ type: 'bin', id: bin.bin_id, name: bin.bin_id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-muted-foreground">
            <span>{total} bins in selection</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </section>
      </div>

      <ZoneFormDialog
        open={zoneDialogOpen}
        onClose={() => { setZoneDialogOpen(false); setEditingZone(null); setZoneForm(emptyZone) }}
        zone={editingZone ?? undefined}
        value={zoneForm}
        onChange={setZoneForm}
        onSubmit={() => zoneMutation.mutate()}
        isPending={zoneMutation.isPending}
        error={zoneMutation.error ? new Error(zoneMutation.error.message) : null}
      />

      <ClusterFormDialog
        open={clusterDialogOpen}
        onClose={() => { setClusterDialogOpen(false); setEditingCluster(null); setClusterForm(emptyCluster(activeZoneId ?? 0)) }}
        cluster={editingCluster ?? undefined}
        zones={zones}
        value={clusterForm}
        onChange={setClusterForm}
        onSubmit={() => clusterMutation.mutate()}
        isPending={clusterMutation.isPending}
        error={clusterMutation.error ? new Error(clusterMutation.error.message) : null}
      />

      <BinFormDialog
        open={binDialogOpen}
        onClose={() => { setBinDialogOpen(false); setEditingBin(null) }}
        bin={editingBin ?? undefined}
        zones={zones}
        clusters={clusters}
        wasteCategories={categoriesQuery.data ?? []}
        initialZoneId={activeZoneId ?? undefined}
        initialClusterId={activeClusterId ?? undefined}
        onSubmit={(values, inline) => binMutation.mutate({ values, inline })}
        isPending={binMutation.isPending}
        error={binMutation.error ? new Error(binMutation.error.message) : null}
      />

      <AlertDialog open={deactivate !== null} onOpenChange={(next) => { if (!next) setDeactivate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivate?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the hierarchy record but marks it inactive so planning and new selections can ignore it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate()}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
