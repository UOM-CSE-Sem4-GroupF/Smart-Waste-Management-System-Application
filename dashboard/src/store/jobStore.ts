import { create } from 'zustand'
import type { CollectionJob, CollectionJobListItem, JobProgress } from '@/types'

interface JobStore {
  jobs:        Map<string, CollectionJob>
  jobProgress: Map<string, JobProgress>
  addJob:             (job: CollectionJob) => void
  updateJob:          (jobId: string, patch: Partial<CollectionJob>) => void
  completeJob:        (jobId: string, patch?: Partial<CollectionJob>) => void
  removeJob:          (jobId: string) => void
  setJobs:            (jobs: CollectionJob[]) => void
  setJobsFromList:    (jobs: CollectionJobListItem[]) => void
  updateJobProgress:  (payload: JobProgress) => void
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

  completeJob: (jobId, patch = {}) =>
    set((state) => {
      const existing = state.jobs.get(jobId)
      if (!existing) return state
      const next = new Map(state.jobs)
      next.set(jobId, { ...existing, ...patch, state: 'COMPLETED' })
      return { jobs: next }
    }),

  removeJob: (jobId) =>
    set((state) => {
      const next = new Map(state.jobs)
      next.delete(jobId)
      const nextProgress = new Map(state.jobProgress)
      nextProgress.delete(jobId)
      return { jobs: next, jobProgress: nextProgress }
    }),
}))
