'use client'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientApiClient } from '@/lib/api-client'
import { getJobs, getJob } from '@/lib/api/jobs'

export function useJobs(params?: {
  state?:    string
  job_type?: string
  zone_id?:  number
  page?:     number
  limit?:    number
}) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => getJobs(createClientApiClient(session?.accessToken), params),
    staleTime: 30_000,
  })
}

export function useJob(jobId: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getJob(createClientApiClient(session?.accessToken), jobId),
    enabled: !!jobId,
    staleTime: 30_000,
  })
}
