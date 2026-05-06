'use client'

import dynamic from 'next/dynamic'
import { BinDetailPanel } from './BinDetailPanel'
import { useBinStore } from '@/store/binStore'
import { cn } from '@/lib/utils'

const MapWithNoSSR = dynamic(
  () => import('./MapInner').then((m) => m.MapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-900" />
    ),
  },
)

export function CityMap() {
  const selectedBinId = useBinStore((s) => s.selectedBinId)

  return (
    <div className="relative flex h-[calc(100vh-10rem)] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      {/* 75% Map Section */}
      <div className={cn(
        "relative h-full transition-all duration-500 ease-in-out",
        selectedBinId ? "w-3/4" : "w-full"
      )}>
        <MapWithNoSSR />
      </div>

      {/* 25% Detail Panel Section */}
      <div className={cn(
        "h-full transition-all duration-500 ease-in-out",
        selectedBinId ? "w-1/4" : "w-0 opacity-0 pointer-events-none"
      )}>
        <BinDetailPanel />
      </div>
    </div>
  )
}

