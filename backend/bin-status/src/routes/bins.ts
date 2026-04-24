import { FastifyInstance } from 'fastify';
import { getAllBins, getBin, getBinHistory } from '../store';

export default async function binsRoutes(app: FastifyInstance) {
  app.get('/api/v1/bins', async (req) => {
    const { zone_id, status, page = '1', limit = '50' } = req.query as Record<string, string>;
    let data = getAllBins();
    if (zone_id) data = data.filter(b => b.zone_id === zone_id);
    if (status)  data = data.filter(b => b.urgency_status === status);
    const p     = Math.max(1, parseInt(page));
    const l     = Math.min(200, Math.max(1, parseInt(limit)));
    const total = data.length;
    return { data: data.slice((p - 1) * l, p * l), total, page: p, limit: l };
  });

  app.get<{ Params: { id: string } }>('/api/v1/bins/:id', async (req, reply) => {
    const bin = getBin(req.params.id);
    if (!bin) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${req.params.id} not found`, timestamp: new Date().toISOString() });
    return bin;
  });

  app.get<{ Params: { id: string } }>('/api/v1/bins/:id/history', async (req, reply) => {
    const bin = getBin(req.params.id);
    if (!bin) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Bin ${req.params.id} not found`, timestamp: new Date().toISOString() });
    return { bin_id: req.params.id, history: getBinHistory(req.params.id) };
  });
}
