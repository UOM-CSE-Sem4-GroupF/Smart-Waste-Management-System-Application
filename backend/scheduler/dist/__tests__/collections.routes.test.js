"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const collections_1 = __importDefault(require("../routes/collections"));
const store_1 = require("../store");
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    app.register(collections_1.default);
    return app;
}
(0, vitest_1.beforeEach)(() => (0, store_1.resetStore)());
(0, vitest_1.describe)('POST /api/v1/collections/:job_id/bins/:bin_id/collected', () => {
    (0, vitest_1.it)('records a bin as collected', async () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        const res = await buildApp().inject({
            method: 'POST',
            url: '/api/v1/collections/JOB-1/bins/B1/collected',
            payload: { actual_weight_kg: 80 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json().success).toBe(true);
    });
    (0, vitest_1.it)('returns 404 when job does not exist', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/api/v1/collections/NOPE/bins/B1/collected',
            payload: {},
        });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
        (0, vitest_1.expect)(res.json().error).toBe('RESOURCE_NOT_FOUND');
    });
});
(0, vitest_1.describe)('POST /api/v1/collections/:job_id/bins/:bin_id/skip', () => {
    (0, vitest_1.it)('records a bin as skipped with a reason', async () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        const res = await buildApp().inject({
            method: 'POST',
            url: '/api/v1/collections/JOB-1/bins/B1/skip',
            payload: { reason: 'road blocked' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json().success).toBe(true);
    });
    (0, vitest_1.it)('returns 400 when reason is missing', async () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        const res = await buildApp().inject({
            method: 'POST',
            url: '/api/v1/collections/JOB-1/bins/B1/skip',
            payload: {},
        });
        (0, vitest_1.expect)(res.statusCode).toBe(400);
        (0, vitest_1.expect)(res.json().error).toBe('VALIDATION_ERROR');
    });
    (0, vitest_1.it)('returns 404 when job does not exist', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/api/v1/collections/NOPE/bins/B1/skip',
            payload: { reason: 'test' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
    });
});
(0, vitest_1.describe)('GET /api/v1/jobs/:job_id/progress', () => {
    (0, vitest_1.it)('returns job progress with bin statuses', async () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/JOB-1/progress' });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const body = res.json();
        (0, vitest_1.expect)(body.job_id).toBe('JOB-1');
        (0, vitest_1.expect)(body.driver_id).toBe('DRV-001');
        (0, vitest_1.expect)(body.current_cargo_kg).toBe(0);
    });
    (0, vitest_1.it)('returns 404 for unknown job', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/NOPE/progress' });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
        (0, vitest_1.expect)(res.json().error).toBe('RESOURCE_NOT_FOUND');
    });
});
