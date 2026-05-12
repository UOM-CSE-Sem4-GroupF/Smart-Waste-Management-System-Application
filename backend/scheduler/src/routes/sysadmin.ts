import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';

interface TableMeta {
  path: string;
  sqlName: string;
  pk: string;
}

const TABLES: TableMeta[] = [
  { path: 'collection-jobs', sqlName: 'f3.collection_jobs', pk: 'id' },
  { path: 'routine-schedules', sqlName: 'f3.routine_schedules', pk: 'id' },
  { path: 'emergency-job-details', sqlName: 'f3.emergency_job_details', pk: 'job_id' },
  { path: 'routine-job-details', sqlName: 'f3.routine_job_details', pk: 'job_id' },
  { path: 'job-execution-metrics', sqlName: 'f3.job_execution_metrics', pk: 'job_id' },
  { path: 'bin-collection-records', sqlName: 'f3.bin_collection_records', pk: 'id' },
  { path: 'job-state-transitions', sqlName: 'f3.job_state_transitions', pk: 'id' },
  { path: 'job-step-results', sqlName: 'f3.job_step_results', pk: 'id' },
  { path: 'driver-assignment-history', sqlName: 'f3.driver_assignment_history', pk: 'id' },
  { path: 'vehicle-weight-logs', sqlName: 'f3.vehicle_weight_logs', pk: 'id' },
];

const slog = (level: string, msg: string, meta?: any) =>
  process.stdout.write(JSON.stringify({ 
    timestamp: new Date().toISOString(), 
    level, 
    service: 'scheduler-sysadmin', 
    message: msg,
    ...meta 
  }) + '\n');

export default async function sysadminRoutes(app: FastifyInstance) {
  for (const table of TABLES) {
    const routePath = `/api/v1/${table.path}`;

    // GET List
    app.get(routePath, async (req, reply) => {
      const query = req.query as Record<string, any>;
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 50);
      const offset = (page - 1) * limit;

      slog('DEBUG', `Listing table ${table.sqlName}`, { page, limit, offset });

      try {
        const data = await prisma.$queryRawUnsafe(`SELECT * FROM ${table.sqlName} ORDER BY ${table.pk} DESC LIMIT $1 OFFSET $2`, limit, offset);
        const countRes = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM ${table.sqlName}`);
        const total = Number(countRes[0].count);

        return {
          data,
          total,
          page,
          pages: Math.ceil(total / limit)
        };
      } catch (err: any) {
        slog('ERROR', `Failed to list ${table.sqlName}`, { error: err.message, stack: err.stack });
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    });

    // POST Create
    app.post(routePath, async (req, reply) => {
      const body = req.body as Record<string, any>;
      if (!body || Object.keys(body).length === 0) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Empty payload' });
      }

      const keys = Object.keys(body);
      const values = Object.values(body);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const sql = `INSERT INTO ${table.sqlName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      slog('DEBUG', `Creating record in ${table.sqlName}`, { keys });

      try {
        const res = await prisma.$queryRawUnsafe<any[]>(sql, ...values);
        slog('INFO', `Created record in ${table.sqlName}`, { pk: res[0][table.pk] });
        return res[0];
      } catch (err: any) {
        slog('ERROR', `Failed to create in ${table.sqlName}`, { error: err.message, body });
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    });

    // PATCH Update
    app.patch(`${routePath}/:id`, async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as Record<string, any>;
      if (!body || Object.keys(body).length === 0) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Empty payload' });
      }

      const keys = Object.keys(body);
      const values = Object.values(body);
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      
      values.push(id);
      
      const sql = `UPDATE ${table.sqlName} SET ${setClause} WHERE ${table.pk}::text = $${values.length}::text RETURNING *`;
      slog('DEBUG', `Updating record ${id} in ${table.sqlName}`, { keys });

      try {
        const res = await prisma.$queryRawUnsafe<any[]>(sql, ...values);
        if (!res || res.length === 0) {
          slog('WARN', `Update target not found: ${table.sqlName} id=${id}`);
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Record not found' });
        }
        slog('INFO', `Updated record ${id} in ${table.sqlName}`);
        return res[0];
      } catch (err: any) {
        slog('ERROR', `Failed to update ${table.sqlName} id=${id}`, { error: err.message, body });
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    });

    // DELETE Remove
    app.delete(`${routePath}/:id`, async (req, reply) => {
      const { id } = req.params as { id: string };
      const sql = `DELETE FROM ${table.sqlName} WHERE ${table.pk}::text = $1::text RETURNING *`;
      slog('DEBUG', `Deleting record ${id} from ${table.sqlName}`);

      try {
        const res = await prisma.$queryRawUnsafe<any[]>(sql, id);
        if (!res || res.length === 0) {
          slog('WARN', `Delete target not found: ${table.sqlName} id=${id}`);
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Record not found' });
        }
        slog('INFO', `Deleted record ${id} from ${table.sqlName}`);
        return { success: true };
      } catch (err: any) {
        slog('ERROR', `Failed to delete ${table.sqlName} id=${id}`, { error: err.message });
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    });
  }
}
