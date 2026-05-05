'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import type { BinStatus, WasteCategory } from '@/types/bin'

const DashboardMap = dynamic(
  () => import('@/components/map/DashboardMap').then((m) => m.DashboardMapInner),
  { ssr: false },
)

const STATUSES: BinStatus[] = ['normal', 'monitor', 'urgent', 'critical', 'offline']
const CATEGORIES: WasteCategory[] = ['food_waste', 'paper', 'glass', 'plastic', 'general', 'e_waste']

export default function MapPage() {
  const [showZones,  setShowZones]  = useState(false)
  const [showRoutes, setShowRoutes] = useState(true)

  const setFilter = useMapStore((s) => s.setFilter)
  const filters   = useMapStore((s) => s.filters)

  function toggleStatus(status: BinStatus) {
    const current = filters.status as BinStatus[]
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    setFilter('status', next)
  }

  function toggleCategory(cat: WasteCategory) {
    const current = filters.wasteCategory as WasteCategory[]
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat]
    setFilter('wasteCategory', next)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Live City Map</h2>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const active = filters.status.length === 0 || (filters.status as BinStatus[]).includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border transition-opacity ${
                  active ? 'opacity-100' : 'opacity-40'
                } bin-${s}`}
              >
                {s}
              </button>
            )
          })}
        </div>

        {/* Waste category chips */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const active =
              filters.wasteCategory.length === 0 ||
              (filters.wasteCategory as WasteCategory[]).includes(cat)
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-opacity ${
                  active ? 'opacity-100 bg-muted' : 'opacity-40'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            )
          })}
        </div>

        {/* Toggle switches */}
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={showZones}
            onChange={(e) => setShowZones(e.target.checked)}
            className="accent-primary"
          />
          Zones
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={showRoutes}
            onChange={(e) => setShowRoutes(e.target.checked)}
            className="accent-primary"
          />
          Routes
        </label>
      </div>

      <div className="h-[calc(100vh-10rem)] w-full overflow-hidden rounded-xl border">
        <DashboardMap showZones={showZones} showRoutes={showRoutes} />
      </div>
    </div>
  )
}

