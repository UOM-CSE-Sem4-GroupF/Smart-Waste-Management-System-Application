import { createApiClient } from '@/lib/api-client'
import { getBins } from '@/lib/api/bins'
import { getJobs } from '@/lib/api/jobs'
import { OverviewClient } from './_components/OverviewClient'
import type { BinUpdatePayload, CollectionJob } from '@/types'

export default async function OverviewPage() {
  let initialBins: BinUpdatePayload[] = []
  let initialJobs: CollectionJob[]    = []

  try {
    const api      = await createApiClient()
    const [binsRes, jobsRes] = await Promise.allSettled([
      getBins(api, { limit: 500 }),
      getJobs(api, { limit: 100 }),
    ])
    if (binsRes.status === 'fulfilled') {
      // Cast REST Bin[] → BinUpdatePayload[] (same fields the store expects)
      initialBins = binsRes.value.data as unknown as BinUpdatePayload[]
    }
    if (jobsRes.status === 'fulfilled') {
      initialJobs = jobsRes.value.data as unknown as CollectionJob[]
    }
  } catch {
    // Backend not yet available — page renders with empty state, populated by socket
  }

  return <OverviewClient initialBins={initialBins} initialJobs={initialJobs} />
}
