"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const internal_1 = __importDefault(require("../routes/internal"));
const store_1 = require("../store");
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    app.register(internal_1.default);
    return app;
}
(0, vitest_1.beforeEach)(() => (0, store_1.resetStore)());
(0, vitest_1.describe)('POST /internal/scheduler/assign', () => {
    (0, vitest_1.it)('assigns an available driver and vehicle, returns their ids', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/scheduler/assign',
            payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'general', planned_weight_kg: 200 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const body = res.json();
        (0, vitest_1.expect)(body.driver_id).toBeDefined();
        (0, vitest_1.expect)(body.vehicle_id).toBeDefined();
        (0, vitest_1.expect)(body.assigned_at).toBeDefined();
        // driver should now be marked unavailable
        (0, vitest_1.expect)(store_1.drivers.get(body.driver_id).available).toBe(false);
    });
    (0, vitest_1.it)('returns 409 when no driver is available', async () => {
        store_1.drivers.forEach(d => { d.available = false; });
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/scheduler/assign',
            payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'general', planned_weight_kg: 200 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(409);
        (0, vitest_1.expect)(res.json().error).toBe('NO_DRIVER_AVAILABLE');
    });
    (0, vitest_1.it)('returns 409 when no vehicle supports the category', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/scheduler/assign',
            payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'radioactive', planned_weight_kg: 100 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(409);
        (0, vitest_1.expect)(res.json().error).toBe('NO_VEHICLE_AVAILABLE');
    });
    (0, vitest_1.it)('respects exclude_driver_ids', async () => {
        // Exclude all Zone-1 drivers — should still assign from another zone
        const zone1Drivers = [...store_1.drivers.values()].filter(d => d.zone_id === 'Zone-1').map(d => d.driver_id);
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/scheduler/assign',
            payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'general', planned_weight_kg: 100, exclude_driver_ids: zone1Drivers },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(zone1Drivers).not.toContain(res.json().driver_id);
    });
});
(0, vitest_1.describe)('POST /internal/scheduler/release', () => {
    (0, vitest_1.it)('releases the job and returns released:true', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/scheduler/release',
            payload: { job_id: 'JOB-UNKNOWN' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json()).toMatchObject({ released: true, job_id: 'JOB-UNKNOWN' });
    });
});
