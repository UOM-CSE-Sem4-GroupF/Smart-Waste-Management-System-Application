import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import collectionJobsRoutes from '../routes/collection-jobs';
import { createJob, transition, clearAll } from '../store';

// Prevent the state machine from making real HTTP calls
vi.mock('../state-machine/machine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../state-machine/machine')>();
  return {
    ...actual,
    runStateMachine: vi.fn().mockResolvedValue(undefined),
  };
});

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(collectionJobsRoutes);
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

  it('filters by state query param', async () => {
    const j1 = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const j2 = createJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(j2, 'CANCELLED');
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?state=CANCELLED' });
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].job_id).toBe(j2.job_id);
  });
});

describe('GET /api/v1/collection-jobs/:id', () => {
  it('returns full job details', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: ['B1'] });
    const res = await buildApp().inject({ method: 'GET', url: `/api/v1/collection-jobs/${job.job_id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().job_id).toBe(job.job_id);
    expect(res.json().bin_ids).toEqual(['B1']);
  });

  it('returns 404 for unknown job', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs/NOPE' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('POST /api/v1/collection-jobs/:id/accept', () => {
  it('accepts a job in AWAITING_ACCEPTANCE and returns new state', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(job, 'AWAITING_ACCEPTANCE');
    const res = await buildApp().inject({
      method: 'POST',
      url: `/api/v1/collection-jobs/${job.job_id}/accept`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('IN_PROGRESS');
  });

  it('returns 409 when job is in wrong state', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const res = await buildApp().inject({
      method: 'POST',
      url: `/api/v1/collection-jobs/${job.job_id}/accept`,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('INVALID_STATE');
  });

  it('returns 404 for unknown job', async () => {
    const res = await buildApp().inject({ method: 'POST', url: '/api/v1/collection-jobs/NOPE/accept' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/v1/collection-jobs/:id/cancel', () => {
  it('cancels a job and returns CANCELLED state', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const res = await buildApp().inject({
      method: 'POST',
      url: `/api/v1/collection-jobs/${job.job_id}/cancel`,
      payload: { reason: 'test cancel' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('CANCELLED');
  });

  it('returns 409 when job is already terminal', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(job, 'COMPLETED');
    const res = await buildApp().inject({
      method: 'POST',
      url: `/api/v1/collection-jobs/${job.job_id}/cancel`,
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/v1/collection-jobs/:id/complete', () => {
  it('returns 409 when job is not IN_PROGRESS', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const res = await buildApp().inject({
      method: 'POST',
      url: `/api/v1/collection-jobs/${job.job_id}/complete`,
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/v1/collection-jobs', () => {
  it('creates a new job and returns 201 with job_id', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collection-jobs',
      payload: { zone_id: 'Z1', bin_ids: ['B1'], waste_category: 'general' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().job_id).toMatch(/^JOB-/);
    expect(res.json().state).toBe('CREATED');
  });
});
