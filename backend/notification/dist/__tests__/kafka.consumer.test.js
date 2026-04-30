"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const consumer_1 = require("../kafka/consumer");
vitest_1.vi.mock('../socket', () => ({
    emitToRoom: vitest_1.vi.fn(),
}));
const socket_1 = require("../socket");
const TS = '2024-01-01T00:00:00.000Z';
(0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
(0, vitest_1.describe)('waste.bin.dashboard.updates', () => {
    (0, vitest_1.describe)('bin:update events', () => {
        (0, vitest_1.it)('emits bin:update to zone and dashboard-all rooms', () => {
            const event = {
                event_type: 'bin:update',
                payload: {
                    bin_id: 'B1',
                    zone_id: 1,
                    fill_level_pct: 60,
                    urgency_score: 60,
                },
            };
            (0, consumer_1.handle)('waste.bin.dashboard.updates', event, TS);
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'bin:update', vitest_1.expect.objectContaining({ bin_id: 'B1' }));
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'bin:update', vitest_1.expect.objectContaining({ bin_id: 'B1' }));
        });
    });
    (0, vitest_1.describe)('zone:stats events', () => {
        (0, vitest_1.it)('emits zone:stats to zone-specific and all rooms', () => {
            const event = {
                event_type: 'zone:stats',
                payload: {
                    zone_id: 1,
                    avg_fill: 65,
                    total_bins: 50,
                },
            };
            (0, consumer_1.handle)('waste.bin.dashboard.updates', event, TS);
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'zone:stats', vitest_1.expect.any(Object));
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'zone:stats', vitest_1.expect.any(Object));
        });
    });
    (0, vitest_1.describe)('alert:urgent events', () => {
        (0, vitest_1.it)('emits alert:urgent to zone, dashboard, and alerts rooms', () => {
            const event = {
                event_type: 'alert:urgent',
                payload: {
                    zone_id: 1,
                    bin_id: 'B1',
                    urgency_score: 90,
                },
            };
            (0, consumer_1.handle)('waste.bin.dashboard.updates', event, TS);
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'alert:urgent', vitest_1.expect.any(Object));
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'alert:urgent', vitest_1.expect.any(Object));
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('alerts-all', 'alert:urgent', vitest_1.expect.any(Object));
        });
    });
});
(0, vitest_1.describe)('waste.vehicle.dashboard.updates', () => {
    (0, vitest_1.describe)('vehicle:position events', () => {
        (0, vitest_1.it)('emits vehicle:position to zone, dashboard, and fleet-ops', () => {
            const event = {
                event_type: 'vehicle:position',
                payload: {
                    vehicle_id: 'V1',
                    zone_id: 1,
                    lat: 6.9,
                    lng: 79.8,
                    speed_kmh: 40,
                },
            };
            (0, consumer_1.handle)('waste.vehicle.dashboard.updates', event, TS);
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'vehicle:position', vitest_1.expect.any(Object));
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'vehicle:position', vitest_1.expect.any(Object));
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('fleet-ops', 'vehicle:position', vitest_1.expect.any(Object));
        });
    });
    (0, vitest_1.describe)('job:progress events', () => {
        (0, vitest_1.it)('emits job:progress to zone and dashboard-all', () => {
            const event = {
                event_type: 'job:progress',
                payload: {
                    job_id: 'JOB-1',
                    zone_id: 1,
                    vehicle_id: 'V1',
                    bins_collected: 5,
                    bins_total: 10,
                },
            };
            (0, consumer_1.handle)('waste.vehicle.dashboard.updates', event, TS);
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'job:progress', vitest_1.expect.any(Object));
            (0, vitest_1.expect)(socket_1.emitToRoom).toHaveBeenCalledWith('dashboard-all', 'job:progress', vitest_1.expect.any(Object));
        });
    });
});
