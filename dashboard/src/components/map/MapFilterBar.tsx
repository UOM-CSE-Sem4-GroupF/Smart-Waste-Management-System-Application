'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import { STATUS_COLORS } from '@/lib/colours'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const WASTE_CATEGORIES = [
  { value: 'food_waste', label: 'Food Waste' },
  { value: 'paper',      label: 'Paper' },
  { value: 'glass',      label: 'Glass' },
  { value: 'plastic',    label: 'Plastic' },
  { value: 'general',    label: 'General' },
  { value: 'e_waste',    label: 'E-Waste' },
]

const STATUS_ORDER = ['normal', 'monitor', 'urgent', 'critical', 'offline'] as const

export function MapFilterBar() {
  const filters      = useMapStore((s) => s.filters)
  const setFilter    = useMapStore((s) => s.setFilter)
  const zoneStats    = useMapStore((s) => s.zoneStats)
  const bins         = useMapStore((s) => s.bins)

  const zones = useMemo(() =>
    Array.from(zoneStats.values()).sort((a, b) => a.zone_id - b.zone_id)
  , [zoneStats])

  const clusters = useMemo(() => {
    const seen = new Map<string, string>()
    for (const bin of bins.values()) {
      if (bin.cluster_id && !seen.has(bin.cluster_id)) {
        seen.set(bin.cluster_id, bin.cluster_name ?? bin.cluster_id)
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [bins])

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.wasteCategory.length > 0 ||
    filters.zoneId !== null ||
    filters.clusterId !== null

  function toggleStatus(status: string) {
    const next = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status]
    setFilter('status', next)
  }

  function toggleCategory(cat: string) {
    const next = filters.wasteCategory.includes(cat)
      ? filters.wasteCategory.filter((c) => c !== cat)
      : [...filters.wasteCategory, cat]
    setFilter('wasteCategory', next)
  }

  function clearAll() {
    setFilter('status', [])
    setFilter('wasteCategory', [])
    setFilter('zoneId', null)
    setFilter('clusterId', null)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
          Status
        </span>
        {STATUS_ORDER.map((status) => {
          const active = filters.status.includes(status)
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                active
                  ? 'border-transparent text-white'
                  : 'border-slate-200 bg-transparent text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
              )}
              style={active ? { backgroundColor: STATUS_COLORS[status] } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              <span className="capitalize">{status}</span>
            </button>
          )
        })}
      </div>

      <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

      {/* Waste category pills */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
          Category
        </span>
        {WASTE_CATEGORIES.map(({ value, label }) => {
          const active = filters.wasteCategory.includes(value)
          return (
            <button
              key={value}
              onClick={() => toggleCategory(value)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                active
                  ? 'border-slate-700 bg-slate-800 text-white dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-transparent text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

      {/* Zone select */}
      <Select
        value={filters.zoneId !== null ? String(filters.zoneId) : 'all'}
        onValueChange={(v) => setFilter('zoneId', v === 'all' ? null : Number(v))}
      >
        <SelectTrigger className="h-7 w-40 rounded-full border-slate-200 text-[11px] font-semibold dark:border-slate-700">
          <SelectValue placeholder="All Zones" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Zones</SelectItem>
          {zones.map((z) => (
            <SelectItem key={z.zone_id} value={String(z.zone_id)}>
              {z.zone_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Cluster select */}
      <Select
        value={filters.clusterId ?? 'all'}
        onValueChange={(v) => setFilter('clusterId', v === 'all' ? null : v)}
      >
        <SelectTrigger className="h-7 w-40 rounded-full border-slate-200 text-[11px] font-semibold dark:border-slate-700">
          <SelectValue placeholder="All Clusters" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clusters</SelectItem>
          {clusters.map(({ id, name }) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="ml-auto h-7 gap-1 rounded-full px-2.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  )
}
