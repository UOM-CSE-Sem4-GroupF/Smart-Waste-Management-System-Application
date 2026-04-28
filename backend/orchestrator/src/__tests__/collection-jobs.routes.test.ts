import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import jobRoutes from '../api/jobRoutes';
import * as db from '../db/queries';

vi.mock('../core/orchestrator', () => ({
  handleJobCompletion:      vi.fn().mockResolvedValue(undefined),
  cancelJobById:            vi.fn().mockResolvedValue(undefined),
  executeEmergencyWorkflow: vi.fn(),
  executeRoutineWorkflow:   vi.fn(),
  derivePriority:           vi.fn().mockReturnValue(2),
}));

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(jobRoutes);
  return app;
}

beforeEach(() => {
  db.clearAll();
  vi.clearAllMocks();
});

describe('GET /api/v1/collection-jobs', () => {
  it('returns empty list when no jobs', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('filters by state query param', async () => {
    const j1 = db.createJob({ job_type: 'emergency', zone_id: 1 });
    const j2 = db.createJob({ job_type: 'routine',   zone_id: 1 });
    db.updateJobState(j2.id, 'CANCELLED');
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?state=CANCELLED' });
    expect(res.json().total).toBe(1);
    expect(res.json().data[0].id).toBe(j2.id);
  });

  it('returns correct page and limit in response', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs?page=2&limit=5' });
    expect(res.json()).toMatchObject({ page: 2, limit: 5 });
  });
});

describe('GET /api/v1/collection-jobs/stats', () => {
  it('returns stats shape with zero values when no jobs', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs/stats' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total_jobs: 0, completion_rate_pct: 0 });
    expect(res.json()).toHaveProperty('emergency_jobs');
    expect(res.json()).toHaveProperty('avg_duration_minutes');
  });
});

describe('GET /api/v1/collection-jobs/:job_id', () => {
  it('returns full job detail with state_history and step_log', async () => {
    const job = db.createJob({ job_type: 'emergency', zone_id: 1, trigger_bin_id: 'B1' });
    db.insertStateTransition({ job_id: job.id, from_state: 'CREATED', to_state: 'BIN_CONFIRMING' });
    db.insertStepResult({ job_id: job.id, step_name: 'bin_confirmation', attempt_number: 1, success: true, duration_ms: 50 });

    const res = await buildApp().inject({ method: 'GET', url: `/api/v1/collection-jobs/${job.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(job.id);
    expect(res.json().trigger_bin_id).toBe('B1');
    expect(res.json().state_history).toHaveLength(1);
    expect(res.json().step_log).toHaveLength(1);
  });

  it('returns 404 for unknown job', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/collection-jobs/NOPE' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('POST /api/v1/collection-jobs/:job_id/cancel', () => {
  it('calls cancelJobById and returns CANCELLED state', async () => {
    const { cancelJobById } = await import('../core/orchestrator');
    const job = db.createJob({ job_type: 'emergency', zone_id: 1 });

    vi.mocked(cancelJobById).mockImplementationOnce(async (id) => {
      db.updateJobState(id, 'CANCELLED');
    });

    const res = await buildApp().inject({
      method:  'POST',
      url:     `/api/v1/collection-jobs/${job.id}/cancel`,
      payload: { reason: 'supervisor override' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('CANCELLED');
  });

  it('returns 409 when cancelJobById throws INVALID_STATE', async () => {
    const { cancelJobById } = await import('../core/orchestrator');
    const job = db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.updateJobState(job.id, 'IN_PROGRESS');
    vi.mocked(cancelJobById).mockRejectedValueOnce(new Error('Cannot cancel job while driver is collecting'));

    const res = await buildApp().inject({
      method:  'POST',
      url:     `/api/v1/collection-jobs/${job.id}/cancel`,
      payload: {},
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('INVALID_STATE');
  });

  it('returns 404 for unknown job', async () => {
    const { cancelJobById } = await import('../core/orchestrator');
    vi.mocked(cancelJobById).mockRejectedValueOnce(new Error('Job NOPE not found'));

    const res = await buildApp().inject({
      method:  'POST',
      url:     '/api/v1/collection-jobs/NOPE/cancel',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /internal/jobs/:job_id/complete', () => {
  it('calls handleJobCompletion and returns updated state', async () => {
    const { handleJobCompletion } = await import('../core/orchestrator');
    const job = db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.updateJobState(job.id, 'IN_PROGRESS');

    vi.mocked(handleJobCompletion).mockImplementationOnce(async (id) => {
      db.updateJobState(id, 'COMPLETED');
    });

    const res = await buildApp().inject({
      method:  'POST',
      url:     `/internal/jobs/${job.id}/complete`,
      payload: {
        job_id: job.id, vehicle_id: 'V1', driver_id: 'D1',
        bins_collected: [], bins_skipped: [],
        actual_weight_kg: 300, actual_distance_km: 15, route_gps_trail: [],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('COMPLETED');
  });

  it('returns 404 when handleJobCompletion throws "not found"', async () => {
    const { handleJobCompletion } = await import('../core/orchestrator');
    vi.mocked(handleJobCompletion).mockRejectedValueOnce(new Error('Job NOPE not found'));

    const res = await buildApp().inject({
      method:  'POST',
      url:     '/internal/jobs/NOPE/complete',
      payload: { job_id: 'NOPE', vehicle_id: 'V1', driver_id: 'D1', bins_collected: [], bins_skipped: [], actual_weight_kg: 0, actual_distance_km: 0, route_gps_trail: [] },
    });
    expect(res.statusCode).toBe(404);
  });
});
