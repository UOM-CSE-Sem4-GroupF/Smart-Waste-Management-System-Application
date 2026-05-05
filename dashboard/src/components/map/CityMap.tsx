'use client'
import dynamic from 'next/dynamic'

const MapWithNoSSR = dynamic(
  () => import('./MapInner').then((m) => m.MapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
    ),
  },
)

export function CityMap() {
  return (
    <div className="h-[calc(100vh-10rem)] w-full overflow-hidden rounded-xl border border-border">
      <MapWithNoSSR />
    </div>
  )
}
