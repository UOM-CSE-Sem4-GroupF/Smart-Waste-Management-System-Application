import { create } from 'zustand'
import type { CollectionJob, CollectionJobListItem, JobProgress } from '@/types'

interface JobStore {
  jobs:        Map<string, CollectionJob>
  jobProgress: Map<string, JobProgress> // live job progress keyed by job_id
  addJob:             (job: CollectionJob) => void
  updateJob:          (jobId: string, patch: Partial<CollectionJob>) => void
  setJobs:            (jobs: CollectionJob[]) => void
  setJobsFromList:    (jobs: CollectionJobListItem[]) => void // maps REST list (uses .id)
  updateJobProgress:  (payload: JobProgress) => void         // from job:progress socket event
}

export const useJobStore = create<JobStore>((set) => ({
  jobs:        new Map(),
  jobProgress: new Map(),

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

  updateJobProgress: (payload) =>
    set((state) => {
      const next = new Map(state.jobProgress)
      next.set(payload.job_id, payload)
      return { jobProgress: next }
    }),
}))
