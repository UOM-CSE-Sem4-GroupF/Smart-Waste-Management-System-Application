import { CityMap } from '@/components/map/CityMap'

export default function MapPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Live City Map</h2>
      <CityMap />
    </div>
  )
}
