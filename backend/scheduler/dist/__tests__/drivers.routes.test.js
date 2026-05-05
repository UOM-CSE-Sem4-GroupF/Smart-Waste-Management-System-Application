"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const drivers_1 = __importDefault(require("../routes/drivers"));
const store_1 = require("../store");
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    app.register(drivers_1.default);
    return app;
}
(0, vitest_1.beforeEach)(() => (0, store_1.resetStore)());
(0, vitest_1.describe)('GET /api/v1/drivers', () => {
    (0, vitest_1.it)('returns all 5 seed drivers', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers' });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json().data).toHaveLength(5);
    });
});
(0, vitest_1.describe)('GET /api/v1/drivers/available', () => {
    (0, vitest_1.it)('returns all 5 when all are free', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/available' });
        (0, vitest_1.expect)(res.json().data).toHaveLength(5);
    });
    (0, vitest_1.it)('excludes drivers currently on a job', async () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 300);
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/available' });
        (0, vitest_1.expect)(res.json().data).toHaveLength(4);
        (0, vitest_1.expect)(res.json().data.map((d) => d.driver_id)).not.toContain('DRV-001');
    });
});
(0, vitest_1.describe)('GET /api/v1/drivers/:id', () => {
    (0, vitest_1.it)('returns driver details', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/DRV-003' });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json().driver_id).toBe('DRV-003');
        (0, vitest_1.expect)(res.json().name).toBe('Kamal Fernando');
    });
    (0, vitest_1.it)('returns 404 for unknown driver', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/GHOST' });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
        (0, vitest_1.expect)(res.json().error).toBe('RESOURCE_NOT_FOUND');
    });
});
