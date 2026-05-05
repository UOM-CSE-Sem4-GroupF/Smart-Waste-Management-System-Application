import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import jobRoutes from '../api/jobRoutes';

vi.mock('../db/queries', async () => {
  let _counter = 0;
  const _jobs    = new Map<string, any>();
  const _history = new Map<string, any[]>();
  const _steps   = new Map<string, any[]>();
  const { validateTransition } = await vi.importActual<any>('../core/stateMachine');

  return {
    insertJob: vi.fn(async (p: any) => {
      const job = {
        job_id: `JOB-${String(++_counter).padStart(4, '0')}`,
        state: 'CREATED',
        clusters: [],
        bins_to_collect: [],
        ...p,
        created_at: new Date().toISOString(),
      };
      _jobs.set(job.job_id, job);
      _history.set(job.job_id, []);
      _steps.set(job.job_id, []);
      return job;
    }),
    clearAll: vi.fn(async () => {
      _jobs.clear(); _history.clear(); _steps.clear(); _counter = 0;
    }),
    getJob: vi.fn(async (id: string) => _jobs.get(id)),
    getJobs: vi.fn(async (filters: any = {}) => {
      let data = [..._jobs.values()];
      if (filters.state)    data = data.filter((j: any) => j.state    === filters.state);
      if (filters.job_type) data = data.filter((j: any) => j.job_type === filters.job_type);
      if (filters.zone_id)  data = data.filter((j: any) => j.zone_id  === filters.zone_id);
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 20;
      return { data: data.slice((page - 1) * limit, page * limit), total: data.length, page, limit };
    }),
    getStats: vi.fn(async () => {
      const all = [..._jobs.values()];
      const total     = all.length;
      const emergency = all.filter((j: any) => j.job_type === 'emergency').length;
      const completed = all.filter((j: any) => j.state    === 'COMPLETED').length;
      const escalated = all.filter((j: any) => j.state    === 'ESCALATED').length;
      return {
        total_jobs: total,
        emergency_jobs: emergency,
        routine_jobs: total - emergency,
        completed_jobs: completed,
        escalated_jobs: escalated,
        cancelled_jobs: 0,
        completion_rate_pct: total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
        avg_duration_minutes: 0,
        avg_bins_per_job: 0,
        avg_weight_per_job_kg: 0,
        emergency_vs_routine_ratio: 0,
      };
    }),
    getStateHistory: vi.fn(async (id: string) => _history.get(id) ?? []),
    getStepLog: vi.fn(async (id: string) => _steps.get(id) ?? []),
    transition: vi.fn(async (job: any, to: string, reason?: string, actor = 'system') => {
      validateTransition(job.state, to);
      const from = job.state;
      job.state = to;
      const h = _history.get(job.job_id) ?? [];
      h.push({ from_state: from, to_state: to, reason, actor, transitioned_at: new Date().toISOString() });
      _history.set(job.job_id, h);
    }),
    updateJob: vi.fn(async (job: any, patch: any) => { Object.assign(job, patch); }),
    recordStep: vi.fn(async () => {}),
    hasActiveJobForBin: vi.fn(async () => false),
  };
});

// Prevent orchestrator workflows from making real HTTP calls
vi.mock('../core/orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/orchestrator')>();
  return {
    ...actual,
    executeEmergencyWorkflow: vi.fn().mockResolvedValue(undefined),
    executeRoutineWorkflow:   vi.fn().mockResolvedValue(undefined),
    completeJob:              vi.fn().mockImplementation(async (job: any) => {
      job.state        = 'COMPLETED';
      job.completed_at = new Date().toISOString();
    }),
    cancelJob: actual.cancelJob,
  };
});

vi.mock('../clients/schedulerClient', () => ({
  dispatch:      vi.fn(),
  releaseDriver: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../clients/notificationClient', () => ({
  notifyDashboard: vi.fn().mockResolvedValue(undefined),
}));

import { insertJob, clearAll } from '../db/queries';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(jobRoutes);
  return app;
}

beforeEach(async () => {
  await clearAll();
  vi.clearAllMocks();
});

describe('GET /api/v1/collection-jobs', () => {
  it('returns empty list when no jobs', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: [], total: 0 });
  });

  it('filters by state', async () => {
    const j1 = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const j2 = await insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    j2.state = 'CANCELLED';
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?state=CANCELLED' });
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].job_id).toBe(j2.job_id);
  });

  it('filters by job_type', async () => {
    await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    await insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?job_type=routine' });
    expect(res.json().total).toBe(1);
  });

  it('filters by zone_id', async () => {
    await insertJob({ job_type: 'emergency', zone_id: 'Zone-1', waste_category: 'general' });
    await insertJob({ job_type: 'emergency', zone_id: 'Zone-2', waste_category: 'general' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?zone_id=Zone-1' });
    expect(res.json().total).toBe(1);
  });
});

describe('GET /api/v1/collection-jobs/stats', () => {
  it('returns stats shape with zeros when no jobs', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('total_jobs', 0);
    expect(body).toHaveProperty('completion_rate_pct');
    expect(body).toHaveProperty('emergency_jobs');
    expect(body).toHaveProperty('routine_jobs');
  });

  it('returns correct counts with jobs', async () => {
    const j1 = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const j2 = await insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    j1.state = 'COMPLETED';
    j2.state = 'ESCALATED';
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs/stats' });
    const body = res.json();
    expect(body.total_jobs).toBe(2);
    expect(body.completed_jobs).toBe(1);
    expect(body.escalated_jobs).toBe(1);
  });
});

describe('GET /api/v1/collection-jobs/:id', () => {
  it('returns full job with state_history and step_log', async () => {
    const job = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const res = await buildApp().inject({ method: 'GET', url: `/api/v1/collection-jobs/${job.job_id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job_id).toBe(job.job_id);
    expect(body).toHaveProperty('state_history');
    expect(body).toHaveProperty('step_log');
  });

  it('returns 404 for unknown job', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs/NOPE' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('POST /api/v1/collection-jobs/:id/cancel', () => {
  it('cancels a job in CREATED state', async () => {
    const job = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const res = await buildApp().inject({
      method:  'POST',
      url:     `/api/v1/collection-jobs/${job.job_id}/cancel`,
      payload: { reason: 'test cancel' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('CANCELLED');
  });

  it('returns 409 when job is IN_PROGRESS', async () => {
    const job = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state = 'IN_PROGRESS';
    const res = await buildApp().inject({
      method:  'POST',
      url:     `/api/v1/collection-jobs/${job.job_id}/cancel`,
      payload: {},
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('CANNOT_CANCEL_IN_PROGRESS');
  });

  it('returns 409 when job is already COMPLETED', async () => {
    const job = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state = 'COMPLETED';
    const res = await buildApp().inject({
      method:  'POST',
      url:     `/api/v1/collection-jobs/${job.job_id}/cancel`,
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /internal/jobs/:id/complete', () => {
  it('completes an IN_PROGRESS job', async () => {
    const job = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state = 'IN_PROGRESS';
    const res = await buildApp().inject({
      method:  'POST',
      url:     `/internal/jobs/${job.job_id}/complete`,
      payload: {
        job_id: job.job_id, vehicle_id: 'VEH-01', driver_id: 'DRV-01',
        bins_collected: [], bins_skipped: [],
        actual_weight_kg: 50, actual_distance_km: 3, route_gps_trail: [],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('COMPLETED');
  });

  it('returns 409 when job is not IN_PROGRESS', async () => {
    const job = await insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const res = await buildApp().inject({
      method:  'POST',
      url:     `/internal/jobs/${job.job_id}/complete`,
      payload: { job_id: job.job_id, vehicle_id: '', driver_id: '', bins_collected: [], bins_skipped: [], actual_weight_kg: 0, actual_distance_km: 0, route_gps_trail: [] },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/v1/collection-jobs', () => {
  it('creates a new emergency job and returns 201', async () => {
    const res = await buildApp().inject({
      method:  'POST',
      url:     '/api/v1/collection-jobs',
      payload: { zone_id: 'Z1', bin_ids: ['B1'], waste_category: 'general' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().job_id).toMatch(/^JOB-/);
    expect(res.json().state).toBe('CREATED');
  });
});
