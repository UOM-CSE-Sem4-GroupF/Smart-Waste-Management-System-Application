'use client'
import dynamic from 'next/dynamic'
import { BinDetailPanel } from '@/components/map/BinDetailPanel'

const DashboardMap = dynamic(
  () => import('@/components/map/DashboardMap'),
  { ssr: false }
)

export default function MapPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Live City Map</h2>
        <p className="text-sm text-muted-foreground mt-1">Real-time bin and vehicle positions across all zones.</p>
      </div>
      <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden border">
        <DashboardMap className="w-full h-full" />
        <BinDetailPanel />
      </div>
    </div>
  )
}
