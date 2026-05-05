import { FastifyInstance } from 'fastify';
import { BinCollectedRequest, BinSkipRequest, JobProgressResponse } from '../types';
import { activeJobs, binCollectionRecords, routePlans, vehicles, drivers } from '../store';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler', message: msg }) + '\n');

export default async function collectionsRoutes(app: FastifyInstance) {
  // POST /api/v1/collections/:job_id/bins/:bin_id/collected
  app.post<{
    Params: { job_id: string; bin_id: string };
    Body: BinCollectedRequest;
  }>('/api/v1/collections/:job_id/bins/:bin_id/collected', async (req, reply) => {
    const { job_id, bin_id } = req.params;
    const {
      fill_level_at_collection,
      gps_lat,
      gps_lng,
      actual_weight_kg,
      notes,
      photo_url
    } = req.body;

    // Validate job exists and is IN_PROGRESS
    const job = activeJobs.get(job_id);
    if (!job || job.state !== 'IN_PROGRESS') {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found or not in progress` });
    }

    // Validate bin belongs to this job
    const binKey = `${job_id}_${bin_id}`;
    const binRecord = binCollectionRecords.get(binKey);
    if (!binRecord) {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${bin_id} not found in job ${job_id}` });
    }

    // Check if bin already collected
    if (binRecord.collected_at) {
      return reply.code(409).send({ error: 'BIN_ALREADY_COLLECTED', message: `Bin ${bin_id} already collected` });
    }

    // Update bin collection record
    binRecord.collected_at = new Date().toISOString();
    binRecord.fill_level_at_collection = fill_level_at_collection;
    binRecord.actual_weight_kg = actual_weight_kg;
    binRecord.gps_lat = gps_lat;
    binRecord.gps_lng = gps_lng;
    binRecord.notes = notes;
    binRecord.photo_url = photo_url;

    // Update cargo tracking
    const allBinRecords = Array.from(binCollectionRecords.values()).filter(br => br.job_id === job_id);
    const cargoWeightKg = allBinRecords
      .filter(br => br.collected_at)
      .reduce((sum, br) => sum + (br.actual_weight_kg || br.estimated_weight_kg), 0);

    const vehicle = vehicles.get(job.assigned_vehicle_id);
    const cargoLimitKg = vehicle?.max_cargo_kg || 0;

    // Check weight limits
    if (cargoWeightKg >= cargoLimitKg * 0.9) {
      slog('WARN', `Job ${job_id}: approaching weight limit (${cargoWeightKg}/${cargoLimitKg}kg)`);
    }

    if (cargoWeightKg >= cargoLimitKg) {
      slog('WARN', `Job ${job_id}: vehicle full, notifying orchestrator`);
      // In real system: POST /internal/jobs/:job_id/vehicle-full
      // await app.inject({ method: 'POST', url: `/internal/jobs/${job_id}/vehicle-full` });
    }

    // Check job completion
    const binsCollected = allBinRecords.filter(br => br.collected_at).length;
    const binsSkipped = allBinRecords.filter(br => br.skipped_at).length;
    const binsPending = allBinRecords.length - binsCollected - binsSkipped;

    if (binsPending === 0) {
      job.state = 'COMPLETED';
      // In real system: POST /internal/jobs/:job_id/complete
      // await app.inject({ method: 'POST', url: `/internal/jobs/${job_id}/complete` });
      slog('INFO', `Job ${job_id} completed`);
    }

    // Return job progress
    const driver = drivers.get(job.assigned_driver_id);
    const jobProgress: JobProgressResponse = {
      job_id,
      state: job.state,
      vehicle_id: job.assigned_vehicle_id,
      driver_id: job.assigned_driver_id,
      driver_name: driver?.name || 'Unknown',
      total_bins: job.total_bins,
      bins_collected: binsCollected,
      bins_skipped: binsSkipped,
      bins_pending: binsPending,
      cargo_weight_kg: cargoWeightKg,
      cargo_limit_kg: cargoLimitKg,
      cargo_utilisation_pct: cargoLimitKg > 0 ? (cargoWeightKg / cargoLimitKg) * 100 : 0,
      estimated_completion_at: null, // Would calculate based on route
      current_stop: null, // Would determine from current position
      waypoints: [] // Would populate from route plan
    };

    return {
      success: true,
      bin_id,
      job_progress: {
        bins_collected: binsCollected,
        bins_skipped: binsSkipped,
        bins_pending: binsPending,
        cargo_weight_kg: cargoWeightKg,
        cargo_limit_kg: cargoLimitKg,
        job_complete: job.state === 'COMPLETED'
      }
    };
  });

  // POST /api/v1/collections/:job_id/bins/:bin_id/skip
  app.post<{
    Params: { job_id: string; bin_id: string };
    Body: BinSkipRequest;
  }>('/api/v1/collections/:job_id/bins/:bin_id/skip', async (req, reply) => {
    const { job_id, bin_id } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'reason is required' });
    }

    // Validate job exists and is IN_PROGRESS
    const job = activeJobs.get(job_id);
    if (!job || job.state !== 'IN_PROGRESS') {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found or not in progress` });
    }

    // Validate bin belongs to this job
    const binKey = `${job_id}_${bin_id}`;
    const binRecord = binCollectionRecords.get(binKey);
    if (!binRecord) {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${bin_id} not found in job ${job_id}` });
    }

    // Check if bin already processed
    if (binRecord.collected_at || binRecord.skipped_at) {
      return reply.code(409).send({ error: 'BIN_ALREADY_PROCESSED', message: `Bin ${bin_id} already processed` });
    }

    // Update bin record
    binRecord.skipped_at = new Date().toISOString();
    binRecord.skip_reason = reason;
    binRecord.skip_notes = notes;

    // Check job completion (same logic as collected)
    const allBinRecords = Array.from(binCollectionRecords.values()).filter(br => br.job_id === job_id);
    const binsCollected = allBinRecords.filter(br => br.collected_at).length;
    const binsSkipped = allBinRecords.filter(br => br.skipped_at).length;
    const binsPending = allBinRecords.length - binsCollected - binsSkipped;

    if (binsPending === 0) {
      job.state = 'COMPLETED';
      slog('INFO', `Job ${job_id} completed`);
    }

    return {
      success: true,
      bin_id,
      job_progress: {
        bins_collected: binsCollected,
        bins_skipped: binsSkipped,
        bins_pending: binsPending,
        cargo_weight_kg: allBinRecords
          .filter(br => br.collected_at)
          .reduce((sum, br) => sum + (br.actual_weight_kg || br.estimated_weight_kg), 0),
        cargo_limit_kg: vehicles.get(job.assigned_vehicle_id)?.max_cargo_kg || 0,
        job_complete: job.state === 'COMPLETED'
      }
    };
  });

  // GET /api/v1/jobs/:job_id/progress
  app.get<{
    Params: { job_id: string };
  }>('/api/v1/jobs/:job_id/progress', async (req, reply) => {
    const { job_id } = req.params;

    const job = activeJobs.get(job_id);
    if (!job) {
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found` });
    }

    const driver = drivers.get(job.assigned_driver_id);
    const vehicle = vehicles.get(job.assigned_vehicle_id);
    const routePlan = Array.from(routePlans.values()).find(rp => rp.job_id === job_id);
    const allBinRecords = Array.from(binCollectionRecords.values()).filter(br => br.job_id === job_id);

    const binsCollected = allBinRecords.filter(br => br.collected_at).length;
    const binsSkipped = allBinRecords.filter(br => br.skipped_at).length;
    const binsPending = allBinRecords.length - binsCollected - binsSkipped;
    const cargoWeightKg = allBinRecords
      .filter(br => br.collected_at)
      .reduce((sum, br) => sum + (br.actual_weight_kg || br.estimated_weight_kg), 0);

    // Mock current stop calculation
    const currentStop = routePlan ? {
      cluster_id: routePlan.waypoints[0]?.cluster_id || '',
      cluster_name: 'Mock Cluster', // Would look up from cluster data
      bins_at_stop: routePlan.waypoints[0]?.bins.length || 0,
      bins_collected_at_stop: 0 // Would calculate based on collected bins at this stop
    } : null;

    // Mock waypoints
    const waypoints = routePlan?.waypoints.map((wp, index) => ({
      sequence: index + 1,
      cluster_id: wp.cluster_id,
      cluster_name: 'Mock Cluster', // Would look up from cluster data
      bins: wp.bins,
      status: 'pending' as const, // Would determine based on progress
      arrived_at: null,
      completed_at: null
    })) || [];

    const response: JobProgressResponse = {
      job_id,
      state: job.state,
      vehicle_id: job.assigned_vehicle_id,
      driver_id: job.assigned_driver_id,
      driver_name: driver?.name || 'Unknown',
      total_bins: job.total_bins,
      bins_collected: binsCollected,
      bins_skipped: binsSkipped,
      bins_pending: binsPending,
      cargo_weight_kg: cargoWeightKg,
      cargo_limit_kg: vehicle?.max_cargo_kg || 0,
      cargo_utilisation_pct: vehicle ? (cargoWeightKg / vehicle.max_cargo_kg) * 100 : 0,
      estimated_completion_at: null,
      current_stop: currentStop,
      waypoints
    };

    return response;
  });
}
