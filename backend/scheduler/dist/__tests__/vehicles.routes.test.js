"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const vehicles_1 = __importDefault(require("../routes/vehicles"));
const store_1 = require("../store");
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    app.register(vehicles_1.default);
    return app;
}
(0, vitest_1.beforeEach)(() => (0, store_1.resetStore)());
(0, vitest_1.describe)('GET /api/v1/vehicles', () => {
    (0, vitest_1.it)('returns all 4 seed vehicles', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles' });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json().data).toHaveLength(4);
    });
});
(0, vitest_1.describe)('GET /api/v1/vehicles/active', () => {
    (0, vitest_1.it)('returns empty when all vehicles are available', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
        (0, vitest_1.expect)(res.json().data).toHaveLength(0);
    });
    (0, vitest_1.it)('returns only vehicles currently on a job', async () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 300);
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
        (0, vitest_1.expect)(res.json().data).toHaveLength(1);
        (0, vitest_1.expect)(res.json().data[0].vehicle_id).toBe('LORRY-01');
    });
});
(0, vitest_1.describe)('GET /api/v1/vehicles/:id', () => {
    (0, vitest_1.it)('returns vehicle details', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/LORRY-02' });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json().vehicle_id).toBe('LORRY-02');
    });
    (0, vitest_1.it)('returns 404 for unknown vehicle', async () => {
        const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/GHOST' });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
        (0, vitest_1.expect)(res.json().error).toBe('RESOURCE_NOT_FOUND');
    });
});
