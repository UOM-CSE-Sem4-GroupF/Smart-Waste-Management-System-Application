import { FastifyInstance } from 'fastify';
import { drivers, vehicles, getJobAssignment, getJobProgressSummary, getRoutePlanByJob } from '../db/queries';

export default async function readRoutes(app: FastifyInstance) {
  app.get('/api/v1/vehicles', async () => {
    return { data: [...vehicles.values()] };
  });

  app.get('/api/v1/vehicles/active', async () => {
    const active = [...vehicles.values()]
      .filter(v => !v.available && v.current_job_id)
      .map(v => {
        const job_id     = v.current_job_id!;
        const assignment = getJobAssignment(job_id);
        const driver     = assignment ? drivers.get(assignment.driver_id) : undefined;
        const progress   = getJobProgressSummary(job_id);
        return {
          vehicle_id:            v.vehicle_id,
          vehicle_name:          v.name,
          driver_id:             driver?.driver_id ?? null,
          driver_name:           driver?.name ?? null,
          job_id,
          cargo_weight_kg:       progress?.cargo_weight_kg ?? 0,
          cargo_limit_kg:        v.max_cargo_kg,
          cargo_utilisation_pct: progress?.cargo_utilisation_pct ?? 0,
          bins_collected:        progress?.bins_collected ?? 0,
          bins_total:            (progress?.bins_collected ?? 0) + (progress?.bins_skipped ?? 0) + (progress?.bins_pending ?? 0),
          current_lat:           v.lat,
          current_lng:           v.lng,
          last_seen_at:          v.last_update,
        };
      });
    return { vehicles: active };
  });

  app.get<{ Params: { id: string } }>('/api/v1/vehicles/:id', async (req, reply) => {
    const v = vehicles.get(req.params.id);
    if (!v) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Vehicle ${req.params.id} not found` });
    return v;
  });

  app.get('/api/v1/drivers', async () => {
    return { data: [...drivers.values()] };
  });

  app.get('/api/v1/drivers/available', async () => {
    const available = [...drivers.values()]
      .filter(d => d.available)
      .map(d => ({
        driver_id:   d.driver_id,
        driver_name: d.name,
        zone_id:     d.zone_id,
        status:      'available',
      }));
    return { drivers: available };
  });

  app.get<{ Params: { id: string } }>('/api/v1/drivers/:id', async (req, reply) => {
    const d = drivers.get(req.params.id);
    if (!d) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${req.params.id} not found` });
    return d;
  });

  app.get<{ Params: { job_id: string } }>('/api/v1/jobs/:job_id/progress', async (req, reply) => {
    const { job_id } = req.params;
    const progress = getJobProgressSummary(job_id);
    if (!progress)
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${job_id} not found` });

    const driver   = drivers.get(progress.driver_id);
    const plan     = getRoutePlanByJob(job_id);

    return {
      job_id,
      vehicle_id:            progress.vehicle_id,
      driver_id:             progress.driver_id,
      driver_name:           driver?.name ?? null,
      total_bins:            progress.bins_collected + progress.bins_skipped + progress.bins_pending,
      bins_collected:        progress.bins_collected,
      bins_skipped:          progress.bins_skipped,
      bins_pending:          progress.bins_pending,
      cargo_weight_kg:       progress.cargo_weight_kg,
      cargo_limit_kg:        progress.cargo_limit_kg,
      cargo_utilisation_pct: progress.cargo_utilisation_pct,
      waypoints:             plan?.waypoints ?? [],
      bin_statuses:          progress.bin_statuses,
    };
  });
}
