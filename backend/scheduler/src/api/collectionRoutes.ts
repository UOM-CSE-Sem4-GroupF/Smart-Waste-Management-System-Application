import { FastifyInstance } from 'fastify';
import {
  getJobAssignment,
  getBinRecord,
  updateBinCollected,
  updateBinSkipped,
  getJobProgressSummary,
  getJobCargoKg,
  vehicles,
} from '../db/queries';
import { notifyJobComplete, notifyVehicleFull } from '../clients/orchestratorClient';

export default async function collectionRoutes(app: FastifyInstance) {
  app.post<{
    Params: { job_id: string; bin_id: string };
    Body: {
      fill_level_at_collection?: number;
      gps_lat?: number;
      gps_lng?: number;
      actual_weight_kg?: number;
      notes?: string;
      photo_url?: string;
    };
  }>('/api/v1/collections/:job_id/bins/:bin_id/collected', async (req, reply) => {
    const { job_id, bin_id } = req.params;

    if (!getJobAssignment(job_id))
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found` });

    const binRec = getBinRecord(job_id, bin_id);
    if (!binRec)
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${bin_id} not in job ${job_id}` });

    if (binRec.status === 'collected')
      return reply.code(409).send({ error: 'ALREADY_COLLECTED', message: `Bin ${bin_id} already collected` });

    updateBinCollected(job_id, bin_id, req.body);

    const progress = getJobProgressSummary(job_id)!;

    // Cargo threshold checks
    const vehicle = vehicles.get(progress.vehicle_id);
    const cargo   = getJobCargoKg(job_id);
    const limit   = vehicle?.max_cargo_kg ?? 0;
    const weight_limit_warning = limit > 0 && cargo >= limit * 0.9;

    if (limit > 0 && cargo >= limit) {
      notifyVehicleFull(job_id).catch(() => undefined);
    }

    // Job completion check
    if (progress.job_complete) {
      notifyJobComplete(job_id, {
        job_id,
        vehicle_id:        progress.vehicle_id,
        driver_id:         progress.driver_id,
        bins_collected:    progress.bin_statuses.filter(b => b.status === 'collected').map(b => b.bin_id),
        bins_skipped:      progress.bin_statuses.filter(b => b.status === 'skipped').map(b => b.bin_id),
        actual_weight_kg:  cargo,
        actual_distance_km: 0,
        route_gps_trail:   [],
      }).catch(() => undefined);
    }

    return {
      success: true,
      bin_id,
      job_progress: {
        bins_collected:        progress.bins_collected,
        bins_skipped:          progress.bins_skipped,
        bins_pending:          progress.bins_pending,
        cargo_weight_kg:       progress.cargo_weight_kg,
        cargo_limit_kg:        progress.cargo_limit_kg,
        cargo_utilisation_pct: progress.cargo_utilisation_pct,
        job_complete:          progress.job_complete,
        weight_limit_warning,
      },
    };
  });

  app.post<{
    Params: { job_id: string; bin_id: string };
    Body: { reason: string; notes?: string };
  }>('/api/v1/collections/:job_id/bins/:bin_id/skip', async (req, reply) => {
    const { job_id, bin_id } = req.params;

    if (!req.body.reason)
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'reason is required' });

    if (!getJobAssignment(job_id))
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found` });

    const binRec = getBinRecord(job_id, bin_id);
    if (!binRec)
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${bin_id} not in job ${job_id}` });

    updateBinSkipped(job_id, bin_id, { skip_reason: req.body.reason, skip_notes: req.body.notes });

    const progress = getJobProgressSummary(job_id)!;

    if (progress.job_complete) {
      notifyJobComplete(job_id, {
        job_id,
        vehicle_id:        progress.vehicle_id,
        driver_id:         progress.driver_id,
        bins_collected:    progress.bin_statuses.filter(b => b.status === 'collected').map(b => b.bin_id),
        bins_skipped:      progress.bin_statuses.filter(b => b.status === 'skipped').map(b => b.bin_id),
        actual_weight_kg:  getJobCargoKg(job_id),
        actual_distance_km: 0,
        route_gps_trail:   [],
      }).catch(() => undefined);
    }

    return {
      success: true,
      bin_id,
      job_progress: {
        bins_collected:        progress.bins_collected,
        bins_skipped:          progress.bins_skipped,
        bins_pending:          progress.bins_pending,
        cargo_weight_kg:       progress.cargo_weight_kg,
        cargo_limit_kg:        progress.cargo_limit_kg,
        cargo_utilisation_pct: progress.cargo_utilisation_pct,
        job_complete:          progress.job_complete,
      },
    };
  });
}
