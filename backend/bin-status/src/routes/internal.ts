import { FastifyInstance } from 'fastify';
import { getBin, upsertBin } from '../store';

export default async function internalRoutes(app: FastifyInstance) {
  // Called by orchestrator: confirm whether a bin is still urgent (urgency_score >= 80)
  app.post<{ Params: { id: string } }>('/internal/bins/:id/confirm-urgency', async (req, reply) => {
    const bin = getBin(req.params.id);
    if (!bin) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${req.params.id} not found` });

    const confirmed = bin.urgency_score >= 80;
    return {
      bin_id:              bin.bin_id,
      confirmed,
      urgency_score:       bin.urgency_score,
      urgency_status:      bin.urgency_status,
      estimated_weight_kg: bin.estimated_weight_kg,
      fill_level_pct:      bin.fill_level_pct,
      waste_category:      bin.waste_category,
    };
  });

  // Called by orchestrator: mark bin as collected, reset fill level
  app.post<{
    Params: { id: string };
    Body:   { job_id: string; collected_at?: string };
  }>('/internal/bins/:id/mark-collected', async (req, reply) => {
    const bin = getBin(req.params.id);
    if (!bin) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${req.params.id} not found` });

    const updated = upsertBin({
      bin_id:             req.params.id,
      collection_status:  'collected',
      fill_level_pct:     0,
      urgency_score:      0,
      urgency_status:     'normal',
      last_collected_at:  req.body.collected_at ?? new Date().toISOString(),
    });
    return { bin_id: updated.bin_id, collection_status: updated.collection_status };
  });
}
