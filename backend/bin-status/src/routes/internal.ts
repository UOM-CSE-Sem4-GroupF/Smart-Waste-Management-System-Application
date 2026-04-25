import { FastifyInstance } from 'fastify';
import { getBin, upsertBin, computeWeight } from '../store';
import { WasteCategory } from '../types';

export default async function internalRoutes(app: FastifyInstance) {
  // Called by telemetry-bridge: ingest a raw telemetry reading
  app.post<{ Body: Record<string, unknown> }>('/internal/bins/ingest', async (req) => {
    const p               = req.body;
    const bin_id          = String(p.bin_id ?? '');
    if (!bin_id) return { ok: false, reason: 'missing bin_id' };

    const waste_category  = (String(p.waste_category ?? 'general')) as WasteCategory;
    const volume_litres   = Number(p.volume_litres   ?? 240);
    const fill_level_pct  = Number(p.fill_level_pct  ?? 0);
    const estimated_weight_kg = Number(p.estimated_weight_kg ?? computeWeight(fill_level_pct, volume_litres, waste_category));
    const urgency_score   = Number(p.urgency_score   ?? fill_level_pct);
    const raw_status      = String(p.urgency_status  ?? '');
    const urgency_status  = (['critical','urgent','monitor','normal'].includes(raw_status) ? raw_status : fill_level_pct >= 90 ? 'critical' : fill_level_pct >= 75 ? 'urgent' : fill_level_pct >= 50 ? 'monitor' : 'normal') as 'critical' | 'urgent' | 'monitor' | 'normal';

    const bin = upsertBin({
      bin_id,
      fill_level_pct,
      urgency_score,
      urgency_status,
      estimated_weight_kg,
      waste_category,
      volume_litres,
      zone_id:          String(p.zone_id   ?? p.zone    ?? 'unknown'),
      lat:              Number(p.latitude  ?? p.lat     ?? 0),
      lng:              Number(p.longitude ?? p.lng     ?? 0),
      last_reading_at:  String(p.timestamp ?? new Date().toISOString()),
    });
    return { ok: true, bin_id: bin.bin_id, fill_level_pct: bin.fill_level_pct };
  });

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
