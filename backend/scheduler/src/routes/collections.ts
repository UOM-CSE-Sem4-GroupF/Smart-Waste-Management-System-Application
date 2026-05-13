import { FastifyInstance } from 'fastify';
import { BinCollectedRequest, BinSkipRequest, JobProgressResponse } from '../types';
import { activeJobs, routePlans, clusterCoordinates } from '../store';
import * as db from '../db/queries';

const CORE_API = process.env.CORE_API_URL ?? 'http://core-api-base-service.waste-dev.svc.cluster.local:8001';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler', message: msg }) + '\n');

export default async function collectionsRoutes(app: FastifyInstance) {
  // POST /api/v1/collections/:job_id/bins/:bin_id/collected
  app.post<{
    Params: { job_id: string; bin_id: string };
    Body:   BinCollectedRequest;
  }>('/api/v1/collections/:job_id/bins/:bin_id/collected', async (req, reply) => {
    const { job_id, bin_id } = req.params;
    const { fill_level_at_collection, gps_lat, gps_lng, actual_weight_kg, notes, photo_url } = req.body;

    const job = activeJobs.get(job_id);
    if (!job || job.state !== 'IN_PROGRESS') {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found or not in progress` });
    }

    const binRecord = await db.getBinRecord(job_id, bin_id);
    if (!binRecord) {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${bin_id} not found in job ${job_id}` });
    }
    if (binRecord.collected_at) {
      return reply.code(409).send({ error: 'BIN_ALREADY_COLLECTED', message: `Bin ${bin_id} already collected` });
    }

    await db.updateBinRecord(job_id, bin_id, {
      collected_at:             new Date().toISOString(),
      fill_level_at_collection: fill_level_at_collection,
      actual_weight_kg:         actual_weight_kg,
      gps_lat,
      gps_lng,
      driver_notes:             notes,
      photo_url,
    });

    const allRecords = await db.getBinRecords(job_id);
    const binsCollected = allRecords.filter(r => r.collected_at).length;
    const binsSkipped   = allRecords.filter(r => r.skipped_at).length;
    const binsPending   = allRecords.length - binsCollected - binsSkipped;
    const cargoWeightKg = allRecords
      .filter(r => r.collected_at)
      .reduce((sum, r) => sum + Number(r.actual_weight_kg ?? r.estimated_weight_kg ?? 0), 0);

    // Vehicle cargo limit from in-memory (set during dispatch)
    // In production: would look up via Core API
    const VEHICLE_LIMIT_KG = 8000;

    if (binsPending === 0) {
      job.state = 'COMPLETED';
      slog('INFO', `Job ${job_id} completed`);
    }

    return {
      success: true,
      bin_id,
      job_progress: {
        bins_collected: binsCollected,
        bins_skipped:   binsSkipped,
        bins_pending:   binsPending,
        cargo_weight_kg: cargoWeightKg,
        cargo_limit_kg:  VEHICLE_LIMIT_KG,
        job_complete:   job.state === 'COMPLETED',
      },
    };
  });

  // POST /api/v1/collections/:job_id/bins/:bin_id/skip
  app.post<{
    Params: { job_id: string; bin_id: string };
    Body:   BinSkipRequest;
  }>('/api/v1/collections/:job_id/bins/:bin_id/skip', async (req, reply) => {
    const { job_id, bin_id } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'reason is required' });
    }

    const job = activeJobs.get(job_id);
    if (!job || job.state !== 'IN_PROGRESS') {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found or not in progress` });
    }

    const binRecord = await db.getBinRecord(job_id, bin_id);
    if (!binRecord) {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${bin_id} not found in job ${job_id}` });
    }
    if (binRecord.collected_at || binRecord.skipped_at) {
      return reply.code(409).send({ error: 'BIN_ALREADY_PROCESSED', message: `Bin ${bin_id} already processed` });
    }

    await db.updateBinRecord(job_id, bin_id, {
      skipped_at:  new Date().toISOString(),
      skip_reason: reason,
      skip_notes:  notes,
    });

    const allRecords    = await db.getBinRecords(job_id);
    const binsCollected = allRecords.filter(r => r.collected_at).length;
    const binsSkipped   = allRecords.filter(r => r.skipped_at).length;
    const binsPending   = allRecords.length - binsCollected - binsSkipped;
    const cargoWeightKg = allRecords
      .filter(r => r.collected_at)
      .reduce((sum, r) => sum + Number(r.actual_weight_kg ?? r.estimated_weight_kg ?? 0), 0);

    if (binsPending === 0) {
      job.state = 'COMPLETED';
      slog('INFO', `Job ${job_id} completed`);
    }

    return {
      success: true,
      bin_id,
      job_progress: {
        bins_collected:  binsCollected,
        bins_skipped:    binsSkipped,
        bins_pending:    binsPending,
        cargo_weight_kg: cargoWeightKg,
        cargo_limit_kg:  8000,
        job_complete:    job.state === 'COMPLETED',
      },
    };
  });

  // GET /api/v1/collections/:job_id/progress  (canonical path used by dashboard)
  // GET /api/v1/jobs/:job_id/progress          (legacy alias)
  async function handleProgress(job_id: string, reply: any) {
    const job = activeJobs.get(job_id);
    if (!job) {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found` });
    }

    const allRecords    = await db.getBinRecords(job_id);
    const binsCollected = allRecords.filter(r => r.collected_at).length;
    const binsSkipped   = allRecords.filter(r => r.skipped_at).length;
    const binsPending   = allRecords.length - binsCollected - binsSkipped;
    const cargoWeightKg = allRecords
      .filter(r => r.collected_at)
      .reduce((sum, r) => sum + Number(r.actual_weight_kg ?? r.estimated_weight_kg ?? 0), 0);

    // Build per-cluster waypoint status from bin records
    const clusterMap = new Map<string, { bins: string[]; arrived_at: string | null; collected_at: string | null; all_done: boolean; any_arrived: boolean }>();
    for (const rec of allRecords) {
      if (!clusterMap.has(rec.cluster_id)) {
        clusterMap.set(rec.cluster_id, { bins: [], arrived_at: null, collected_at: null, all_done: true, any_arrived: false });
      }
      const entry = clusterMap.get(rec.cluster_id)!;
      entry.bins.push(rec.bin_id);
      if (!rec.collected_at && !rec.skipped_at) entry.all_done = false;
      if (rec.arrived_at) {
        entry.any_arrived = true;
        const arrivedIso = rec.arrived_at instanceof Date ? rec.arrived_at.toISOString() : String(rec.arrived_at);
        if (!entry.arrived_at || arrivedIso < entry.arrived_at) entry.arrived_at = arrivedIso;
      }
      if (rec.collected_at) {
        const ts = rec.collected_at.toString();
        if (!entry.collected_at || ts > entry.collected_at) entry.collected_at = ts;
      }
    }

    // Get cluster name + sequence from in-memory route plan if available
    const routePlan = Array.from(routePlans.values()).find(rp => rp.job_id === job_id);
    const waypointMeta = new Map<string, { sequence: number; cluster_name: string }>();
    if (routePlan) {
      routePlan.waypoints.forEach((wp, idx) => {
        waypointMeta.set(wp.cluster_id, { sequence: idx + 1, cluster_name: wp.cluster_id });
      });
    }

    const waypoints = Array.from(clusterMap.entries())
      .map(([cluster_id, entry], idx) => {
        const meta   = waypointMeta.get(cluster_id);
        const coords = clusterCoordinates.get(cluster_id);
        const status: 'completed' | 'current' | 'pending' =
          entry.all_done ? 'completed' :
          entry.any_arrived ? 'current' :
          'pending';
        return {
          sequence:     meta?.sequence ?? idx + 1,
          cluster_id,
          cluster_name: meta?.cluster_name ?? cluster_id,
          bins:         entry.bins,
          status,
          arrived_at:   entry.arrived_at,
          completed_at: entry.all_done ? entry.collected_at : null,
          lat:          coords?.lat ?? null,
          lng:          coords?.lng ?? null,
        };
      })
      .sort((a, b) => a.sequence - b.sequence);

    const response: JobProgressResponse = {
      job_id,
      state:                   job.state,
      vehicle_id:              job.assigned_vehicle_id,
      driver_id:               job.assigned_driver_id,
      driver_name:             'Unknown',
      total_bins:              job.total_bins,
      bins_collected:          binsCollected,
      bins_skipped:            binsSkipped,
      bins_pending:            binsPending,
      cargo_weight_kg:         cargoWeightKg,
      cargo_limit_kg:          8000,
      cargo_utilisation_pct:   (cargoWeightKg / 8000) * 100,
      estimated_completion_at: null,
      current_stop:            null,
      waypoints,
    };

    return response;
  }

  app.get<{ Params: { job_id: string } }>('/api/v1/collections/:job_id/progress', (req, reply) =>
    handleProgress(req.params.job_id, reply),
  );

  app.get<{ Params: { job_id: string } }>('/api/v1/jobs/:job_id/progress', (req, reply) =>
    handleProgress(req.params.job_id, reply),
  );

  // GET /api/v1/route-plans/:id  — proxy to Core API (stores waypoints with lat/lng + polyline)
  app.get<{ Params: { id: string } }>('/api/v1/route-plans/:id', async (req, reply) => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/route-plans/${req.params.id}`);
      if (!res.ok) {
        return reply.code(res.status).send({ error: 'ROUTE_PLAN_NOT_FOUND', message: `Route plan ${req.params.id} not found` });
      }
      const body = await res.json() as { data?: unknown };
      return body.data ?? body;
    } catch (e) {
      return reply.code(502).send({ error: 'CORE_API_UNAVAILABLE', message: (e as Error).message });
    }
  });
}
