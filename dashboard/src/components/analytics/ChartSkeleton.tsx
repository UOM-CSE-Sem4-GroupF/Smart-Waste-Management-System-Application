import { Skeleton } from '@/components/ui/skeleton'

interface ChartSkeletonProps {
  height?: string  // Tailwind height class, default "h-64"
}

export function ChartSkeleton({ height = 'h-64' }: ChartSkeletonProps) {
  return (
    <Skeleton className={`${height} w-full rounded-xl`} />
  )
}
