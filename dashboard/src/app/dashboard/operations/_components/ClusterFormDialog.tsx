'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MapPin } from 'lucide-react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEFAULT_CENTER } from '@/lib/mapbox'
import type { CoreCluster, ZoneOption } from '@/lib/api/metadata'

function MapPicker({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN

    const initLng = lng || DEFAULT_CENTER[0]
    const initLat = lat || DEFAULT_CENTER[1]

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initLng, initLat],
      zoom: 14,
    })

    const marker = new mapboxgl.Marker({ draggable: true, color: '#10b981' })
      .setLngLat([initLng, initLat])
      .addTo(map)

    marker.on('dragend', () => {
      const { lat: newLat, lng: newLng } = marker.getLngLat()
      onChange(parseFloat(newLat.toFixed(6)), parseFloat(newLng.toFixed(6)))
    })

    map.on('click', (e) => {
      const { lat: newLat, lng: newLng } = e.lngLat
      marker.setLngLat([newLng, newLat])
      onChange(parseFloat(newLat.toFixed(6)), parseFloat(newLng.toFixed(6)))
    })

    mapRef.current = map
    markerRef.current = marker

    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync marker when lat/lng inputs change externally
  useEffect(() => {
    if (!markerRef.current || !lat || !lng) return
    markerRef.current.setLngLat([lng, lat])
    mapRef.current?.easeTo({ center: [lng, lat] })
  }, [lat, lng])

  return <div ref={containerRef} className="h-48 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700" />
}

export type ClusterFormValues = {
  id: string
  zone_id: number
  name: string
  lat: number
  lng: number
  address?: string
  cluster_type?: string
  notes?: string
}

interface FieldsProps {
  value: ClusterFormValues
  onChange: (value: ClusterFormValues) => void
  zones: ZoneOption[]
  lockZone?: boolean
  isEdit?: boolean
}

export function ClusterFormFields({ value, onChange, zones, lockZone, isEdit }: FieldsProps) {
  const update = (patch: Partial<ClusterFormValues>) => onChange({ ...value, ...patch })
  const [showMap, setShowMap] = useState(false)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="cluster-id">Cluster ID*</Label>
        <Input id="cluster-id" value={value.id} readOnly={isEdit} onChange={(event) => update({ id: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Zone*</Label>
        <Select
          value={value.zone_id ? String(value.zone_id) : undefined}
          disabled={lockZone}
          onValueChange={(next) => update({ zone_id: Number(next) })}
        >
          <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={String(zone.id)}>{zone.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="cluster-name">Cluster name*</Label>
        <Input id="cluster-name" value={value.name} onChange={(event) => update({ name: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cluster-lat">Latitude*</Label>
        <Input id="cluster-lat" type="number" step="any" value={value.lat} onChange={(event) => update({ lat: Number(event.target.value) })} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="cluster-lng">Longitude*</Label>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            <MapPin className="h-3 w-3" />
            {showMap ? 'Hide map' : 'Pick on map'}
          </button>
        </div>
        <Input id="cluster-lng" type="number" step="any" value={value.lng} onChange={(event) => update({ lng: Number(event.target.value) })} />
      </div>
      {showMap && (
        <div className="md:col-span-2">
          <MapPicker
            lat={value.lat}
            lng={value.lng}
            onChange={(lat, lng) => update({ lat, lng })}
          />
          <p className="mt-1 text-[11px] text-slate-400">Click the map or drag the pin to set the location.</p>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="cluster-type">Cluster type</Label>
        <Input id="cluster-type" value={value.cluster_type ?? ''} onChange={(event) => update({ cluster_type: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cluster-address">Address</Label>
        <Input id="cluster-address" value={value.address ?? ''} onChange={(event) => update({ address: event.target.value })} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="cluster-notes">Notes</Label>
        <Input id="cluster-notes" value={value.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  cluster?: CoreCluster
  zones: ZoneOption[]
  value: ClusterFormValues
  onChange: (value: ClusterFormValues) => void
  onSubmit: () => void
  isPending?: boolean
  error?: Error | null
}

export function ClusterFormDialog({ open, onClose, cluster, zones, value, onChange, onSubmit, isPending, error }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cluster ? `Edit ${cluster.name}` : 'Create Cluster'}</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in the details to {cluster ? 'update the existing' : 'create a new'} cluster.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ClusterFormFields value={value} onChange={onChange} zones={zones} isEdit={!!cluster} />
          {error && <p className="text-sm text-red-500">{error.message}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="button" disabled={isPending} onClick={onSubmit}>
            {isPending ? 'Saving...' : 'Save Cluster'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
