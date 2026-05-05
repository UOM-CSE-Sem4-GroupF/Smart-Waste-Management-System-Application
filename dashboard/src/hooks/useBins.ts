'use client'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientApiClient } from '@/lib/api-client'
import { getBins } from '@/lib/api/bins'

export function useBins(params?: {
  zone_id?:        number
  status?:         string
  waste_category?: string
  page?:           number
  limit?:          number
}) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['bins', params],
    queryFn: () => getBins(createClientApiClient(session?.accessToken), params),
    staleTime: 30_000,
  })
}
