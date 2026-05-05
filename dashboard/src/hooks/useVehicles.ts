'use client'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientApiClient } from '@/lib/api-client'
import { getActiveVehicles } from '@/lib/api/vehicles'

export function useVehicles() {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['vehicles', 'active'],
    queryFn: () => getActiveVehicles(createClientApiClient(session!.accessToken)),
    enabled: !!session?.accessToken,
    staleTime: 30_000,
  })
}
