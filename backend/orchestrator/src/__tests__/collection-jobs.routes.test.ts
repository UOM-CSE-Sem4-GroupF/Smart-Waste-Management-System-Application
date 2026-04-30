import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import jobRoutes from '../api/jobRoutes';
import { insertJob, clearAll } from '../db/queries';

// Prevent orchestrator workflows from making real HTTP calls
vi.mock('../core/orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/orchestrator')>();
  return {
    ...actual,
    executeEmergencyWorkflow: vi.fn().mockResolvedValue(undefined),
    executeRoutineWorkflow:   vi.fn().mockResolvedValue(undefined),
    completeJob:              vi.fn().mockImplementation(async (job) => {
      // Simulate completing the job
      job.state        = 'COMPLETED';
      job.completed_at = new Date().toISOString();
    }),
    cancelJob: actual.cancelJob,
  };
});

// Prevent clients from making network calls when cancelJob is called
vi.mock('../clients/schedulerClient', () => ({
  dispatch:      vi.fn(),
  releaseDriver: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../clients/notificationClient', () => ({
  notifyDashboard: vi.fn().mockResolvedValue(undefined),
}));

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(jobRoutes);
  return app;
}

beforeEach(() => {
  clearAll();
  vi.clearAllMocks();
});

describe('GET /api/v1/collection-jobs', () => {
  it('returns empty list when no jobs', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: [], total: 0 });
  });

  it('filters by state', async () => {
    const j1 = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const j2 = insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    j2.state = 'CANCELLED';
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?state=CANCELLED' });
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].job_id).toBe(j2.job_id);
  });

  it('filters by job_type', async () => {
    insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?job_type=routine' });
    expect(res.json().total).toBe(1);
  });

  it('filters by zone_id', async () => {
    insertJob({ job_type: 'emergency', zone_id: 'Zone-1', waste_category: 'general' });
    insertJob({ job_type: 'emergency', zone_id: 'Zone-2', waste_category: 'general' });
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
    const j1 = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const j2 = insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
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
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
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
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const res = await buildApp().inject({
      method:  'POST',
      url:     `/api/v1/collection-jobs/${job.job_id}/cancel`,
      payload: { reason: 'test cancel' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('CANCELLED');
  });

  it('returns 409 when job is IN_PROGRESS', async () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
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
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
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
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
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
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
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
