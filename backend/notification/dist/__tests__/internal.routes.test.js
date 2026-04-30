"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const internal_1 = __importDefault(require("../routes/internal"));
vitest_1.vi.mock('../socket', () => ({
    emitToRoom: vitest_1.vi.fn(),
    findConnectedSocket: vitest_1.vi.fn(() => null), // Default: driver not connected
    setSocketServer: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../fcm', () => ({
    sendPush: vitest_1.vi.fn(),
}));
const socket_1 = require("../socket");
const fcm_1 = require("../fcm");
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    app.register(internal_1.default);
    return app;
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
    vitest_1.vi.mocked(socket_1.findConnectedSocket).mockReturnValue(null); // Driver not connected by default
});
(0, vitest_1.describe)('POST /internal/notify/job-assigned', () => {
    (0, vitest_1.it)('emits job:assigned to driver room and sends FCM', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/job-assigned',
            payload: {
                driver_id: 'DRV-001',
                vehicle_id: 'LORRY-01',
                job_id: 'JOB-1',
                job_type: 'emergency',
                clusters: [],
                route: [],
                estimated_duration_min: 30,
                planned_weight_kg: 500,
                total_bins: 5,
            },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:assigned', vitest_1.expect.objectContaining({ job_id: 'JOB-1' }));
        (0, vitest_1.expect)(fcm_1.sendPush).toHaveBeenCalledWith('DRV-001', vitest_1.expect.any(Object), vitest_1.expect.any(Object));
    });
    (0, vitest_1.it)('does not send FCM when driver is connected to Socket.IO', async () => {
        vitest_1.vi.mocked(socket_1.findConnectedSocket).mockReturnValue('socket-123');
        await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/job-assigned',
            payload: {
                driver_id: 'DRV-001',
                vehicle_id: 'LORRY-01',
                job_id: 'JOB-1',
                job_type: 'routine',
                clusters: [],
                route: [],
                estimated_duration_min: 30,
                planned_weight_kg: 500,
                total_bins: 5,
            },
        });
        (0, vitest_1.expect)(fcm_1.sendPush).not.toHaveBeenCalled();
    });
});
(0, vitest_1.describe)('POST /internal/notify/job-created', () => {
    (0, vitest_1.it)('emits job:created to zone and fleet-ops rooms', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/job-created',
            payload: {
                job_id: 'JOB-1',
                job_type: 'routine',
                zone_id: 1,
                zone_name: 'South',
                clusters: ['C1', 'C2'],
                vehicle_id: 'LORRY-01',
                driver_id: 'DRV-001',
                total_bins: 10,
                planned_weight_kg: 800,
                priority: 1,
                route: [],
            },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'job:created', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'job:created', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('fleet-ops', 'job:created', vitest_1.expect.any(Object));
    });
});
(0, vitest_1.describe)('POST /internal/notify/job-completed', () => {
    (0, vitest_1.it)('emits to dashboard and driver, sends FCM when driver not connected', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/job-completed',
            payload: {
                job_id: 'JOB-1',
                zone_id: 1,
                vehicle_id: 'LORRY-01',
                driver_id: 'DRV-001',
                bins_collected: 10,
                bins_skipped: 0,
                actual_weight_kg: 800,
                duration_minutes: 120,
            },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'job:completed', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:completed', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(fcm_1.sendPush).toHaveBeenCalledWith('DRV-001', vitest_1.expect.any(Object), vitest_1.expect.any(Object));
    });
});
(0, vitest_1.describe)('POST /internal/notify/job-cancelled', () => {
    (0, vitest_1.it)('emits to driver and dashboard when driver_id provided', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/job-cancelled',
            payload: {
                job_id: 'JOB-1',
                zone_id: 1,
                reason: 'operator request',
                driver_id: 'DRV-001',
            },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:cancelled', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'job:cancelled', vitest_1.expect.any(Object));
    });
    (0, vitest_1.it)('only emits to dashboard when driver_id is absent', async () => {
        await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/job-cancelled',
            payload: {
                job_id: 'JOB-1',
                zone_id: 1,
                reason: 'operator request',
            },
        });
        const driverCalls = vitest_1.vi.mocked(socket_1.emitToRoom).mock.calls.filter(([room]) => room.startsWith('driver-'));
        (0, vitest_1.expect)(driverCalls).toHaveLength(0);
    });
});
(0, vitest_1.describe)('POST /internal/notify/job-escalated', () => {
    (0, vitest_1.it)('emits alert:escalated to dashboard and alerts rooms', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/job-escalated',
            payload: {
                job_id: 'JOB-1',
                zone_id: 1,
                reason: 'no drivers available',
                urgent_bins: [{ bin_id: 'B1', urgency_score: 85 }],
                total_weight_kg: 500,
            },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'alert:escalated', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('alerts-all', 'alert:escalated', vitest_1.expect.any(Object));
    });
});
(0, vitest_1.describe)('POST /internal/notify/vehicle-position', () => {
    (0, vitest_1.it)('emits vehicle:position to zone, dashboard, and fleet-ops', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/vehicle-position',
            payload: {
                vehicle_id: 'LORRY-01',
                driver_id: 'DRV-001',
                job_id: 'JOB-1',
                zone_id: 1,
                lat: 6.9,
                lng: 79.8,
                speed_kmh: 40,
                cargo_weight_kg: 500,
                cargo_limit_kg: 1000,
                cargo_utilisation_pct: 50,
                bins_collected: 5,
                bins_total: 10,
            },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'vehicle:position', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'vehicle:position', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('fleet-ops', 'vehicle:position', vitest_1.expect.any(Object));
    });
    (0, vitest_1.it)('emits weight-limit alert when cargo_utilisation_pct > 90', async () => {
        await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/vehicle-position',
            payload: {
                vehicle_id: 'LORRY-01',
                driver_id: 'DRV-001',
                job_id: 'JOB-1',
                zone_id: 1,
                lat: 6.9,
                lng: 79.8,
                speed_kmh: 40,
                cargo_weight_kg: 950,
                cargo_limit_kg: 1000,
                cargo_utilisation_pct: 95,
                bins_collected: 9,
                bins_total: 10,
                weight_limit_warning: true,
            },
        });
        const weightAlerts = vitest_1.vi.mocked(socket_1.emitToRoom).mock.calls.filter(([, event]) => event === 'alert:weight-limit');
        (0, vitest_1.expect)(weightAlerts.length).toBeGreaterThan(0);
    });
});
(0, vitest_1.describe)('POST /internal/notify/alert-deviation', () => {
    (0, vitest_1.it)('emits alert:deviation to fleet-ops and zone rooms', async () => {
        const res = await buildApp().inject({
            method: 'POST',
            url: '/internal/notify/alert-deviation',
            payload: {
                vehicle_id: 'LORRY-01',
                driver_id: 'DRV-001',
                job_id: 'JOB-1',
                zone_id: 1,
                deviation_metres: 500,
                duration_seconds: 60,
                message: 'Vehicle off route by 500m for 60 seconds',
            },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('fleet-ops', 'alert:deviation', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'alert:deviation', vitest_1.expect.any(Object));
        (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('alerts-all', 'alert:deviation', vitest_1.expect.any(Object));
    });
});
