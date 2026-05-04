import { create } from 'zustand'
import type { CollectionJob, CollectionJobListItem } from '@/types'

interface JobCompletedEvent {
  job_id:          string
  bins_collected:  number
  [key: string]:   unknown
}

interface JobStore {
  jobs:         Map<string, CollectionJob>
  addJob:       (job: CollectionJob) => void
  updateJob:    (jobId: string, patch: Partial<CollectionJob>) => void
  setJobs:      (jobs: CollectionJob[]) => void
  setJobsFromList: (jobs: CollectionJobListItem[]) => void
  completeJob:  (event: JobCompletedEvent) => void
  removeJob:    (jobId: string) => void
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: new Map(),

  addJob: (job) =>
    set((state) => {
      const next = new Map(state.jobs)
      next.set(job.job_id, job)
      return { jobs: next }
    }),

  updateJob: (jobId, patch) =>
    set((state) => {
      const existing = state.jobs.get(jobId)
      if (!existing) return state
      const next = new Map(state.jobs)
      next.set(jobId, { ...existing, ...patch })
      return { jobs: next }
    }),

  setJobs: (list) =>
    set(() => ({
      jobs: new Map(list.map((j) => [j.job_id, j])),
    })),

  setJobsFromList: (list) =>
    set(() => ({
      // REST GET /api/v1/collection-jobs returns CollectionJobListItem with .id (not .job_id)
      jobs: new Map(list.map((j) => [j.id, j as unknown as CollectionJob])),
    })),

  completeJob: (event) =>
    set((state) => {
      const existing = state.jobs.get(event.job_id)
      if (!existing) return state
      const next = new Map(state.jobs)
      next.set(event.job_id, {
        ...existing,
        state:          'COMPLETED',
        bins_collected: event.bins_collected,
      })
      return { jobs: next }
    }),

  removeJob: (jobId) =>
    set((state) => {
      const next = new Map(state.jobs)
      next.delete(jobId)
      return { jobs: next }
    }),
}))
