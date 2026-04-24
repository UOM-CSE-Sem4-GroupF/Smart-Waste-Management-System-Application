import { FastifyInstance } from 'fastify';
import { getAllBins, getBinsByZone } from '../store';

export default async function zonesRoutes(app: FastifyInstance) {
  app.get('/api/v1/zones', async () => {
    const bins   = getAllBins();
    const zoneIds = [...new Set(bins.map(b => b.zone_id))];
    return {
      data: zoneIds.map(zone_id => {
        const zBins        = bins.filter(b => b.zone_id === zone_id);
        const avgFill      = zBins.reduce((s, b) => s + b.fill_level_pct, 0) / zBins.length;
        const totalWeight  = zBins.reduce((s, b) => s + b.estimated_weight_kg, 0);
        return {
          zone_id,
          bin_count:                  zBins.length,
          avg_fill_pct:               parseFloat(avgFill.toFixed(1)),
          total_estimated_weight_kg:  parseFloat(totalWeight.toFixed(2)),
          urgent_bins:                zBins.filter(b => b.urgency_score >= 80).length,
        };
      }),
    };
  });

  app.get<{ Params: { id: string } }>('/api/v1/zones/:id/summary', async (req, reply) => {
    const bins = getBinsByZone(req.params.id);
    if (bins.length === 0)
      return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Zone ${req.params.id} not found`, timestamp: new Date().toISOString() });

    const avgFill     = bins.reduce((s, b) => s + b.fill_level_pct, 0) / bins.length;
    const totalWeight = bins.reduce((s, b) => s + b.estimated_weight_kg, 0);

    return {
      zone_id:                    req.params.id,
      bin_count:                  bins.length,
      avg_fill_pct:               parseFloat(avgFill.toFixed(1)),
      urgent_bins:                bins.filter(b => b.urgency_score >= 80).length,
      critical_bins:              bins.filter(b => b.urgency_status === 'critical').length,
      total_estimated_weight_kg:  parseFloat(totalWeight.toFixed(2)),
      bins_by_status: {
        normal:   bins.filter(b => b.urgency_status === 'normal').length,
        monitor:  bins.filter(b => b.urgency_status === 'monitor').length,
        urgent:   bins.filter(b => b.urgency_status === 'urgent').length,
        critical: bins.filter(b => b.urgency_status === 'critical').length,
      },
    };
  });
}
