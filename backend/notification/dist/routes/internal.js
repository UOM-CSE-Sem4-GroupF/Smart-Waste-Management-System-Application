"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = internalRoutes;
const socket_1 = require("../socket");
const socket_2 = require("../socket");
const fcm_1 = require("../fcm");
async function internalRoutes(app) {
    // POST /internal/notify/job-assigned
    // Called by scheduler when driver is dispatched
    app.post('/internal/notify/job-assigned', async (req) => {
        const { driver_id, vehicle_id, job_id, job_type, clusters, route, estimated_duration_min, planned_weight_kg, total_bins } = req.body;
        const ts = new Date().toISOString();
        const payload = {
            driver_id,
            vehicle_id,
            job_id,
            job_type,
            clusters,
            route,
            estimated_duration_min,
            planned_weight_kg,
            total_bins,
            timestamp: ts,
        };
        // 1. Emit via Socket.IO to driver room
        (0, socket_1.emitToRoom)(`driver-${driver_id}`, 'job:assigned', payload);
        // 2. Send FCM push if driver not connected to Socket.IO
        const driverConnected = (0, socket_2.findConnectedSocket)((socket) => socket.data.driverId === driver_id);
        if (!driverConnected) {
            await (0, fcm_1.sendPush)(driver_id, {
                title: 'New collection job assigned',
                body: `You have a new ${job_type} collection — ${total_bins} bins`,
            }, {
                job_id,
                job_type,
                screen: 'job-detail',
            });
        }
        return { delivered: true, ts };
    });
    // POST /internal/notify/job-created
    // Called by orchestrator after successful dispatch — notifies dashboard
    app.post('/internal/notify/job-created', async (req) => {
        const { job_id, job_type, zone_id, zone_name, clusters, vehicle_id, driver_id, total_bins, planned_weight_kg, priority, route } = req.body;
        const ts = new Date().toISOString();
        const payload = {
            job_id,
            job_type,
            zone_id,
            zone_name,
            clusters,
            vehicle_id,
            driver_id,
            total_bins,
            planned_weight_kg,
            priority,
            route,
            timestamp: ts,
        };
        // Emit to zone-specific rooms and fleet-ops
        (0, socket_1.emitToRoom)(`dashboard-zone-${zone_id}`, 'job:created', payload);
        (0, socket_1.emitToRoom)('dashboard-all', 'job:created', payload);
        (0, socket_1.emitToRoom)('fleet-ops', 'job:created', payload);
        return { delivered: true, ts };
    });
    // POST /internal/notify/job-completed
    // Called by orchestrator when job reaches COMPLETED state
    app.post('/internal/notify/job-completed', async (req) => {
        const { job_id, zone_id, vehicle_id, driver_id, bins_collected, bins_skipped, actual_weight_kg, duration_minutes, hyperledger_tx_id } = req.body;
        const ts = new Date().toISOString();
        const payload = {
            job_id,
            zone_id,
            vehicle_id,
            driver_id,
            bins_collected,
            bins_skipped,
            actual_weight_kg,
            duration_minutes,
            hyperledger_tx_id,
            timestamp: ts,
        };
        // 1. Emit to dashboard
        (0, socket_1.emitToRoom)(`dashboard-zone-${zone_id}`, 'job:completed', payload);
        (0, socket_1.emitToRoom)('dashboard-all', 'job:completed', payload);
        (0, socket_1.emitToRoom)('fleet-ops', 'job:completed', payload);
        // 2. Emit to driver
        (0, socket_1.emitToRoom)(`driver-${driver_id}`, 'job:completed', { job_id, message: 'Job complete. Well done!', timestamp: ts });
        // 3. Optional FCM to driver if disconnected
        const driverConnected = (0, socket_2.findConnectedSocket)((socket) => socket.data.driverId === driver_id);
        if (!driverConnected) {
            await (0, fcm_1.sendPush)(driver_id, {
                title: 'Job complete',
                body: 'Well done! Your collection job is complete.',
            }, {
                job_id,
                screen: 'home',
            });
        }
        return { delivered: true, ts };
    });
    // POST /internal/notify/job-cancelled
    // Called by orchestrator when job is cancelled
    app.post('/internal/notify/job-cancelled', async (req) => {
        const { job_id, zone_id, driver_id, reason } = req.body;
        const ts = new Date().toISOString();
        const payload = {
            job_id,
            zone_id,
            reason,
            timestamp: ts,
        };
        // 1. Notify dashboard
        (0, socket_1.emitToRoom)(`dashboard-zone-${zone_id}`, 'job:cancelled', payload);
        (0, socket_1.emitToRoom)('dashboard-all', 'job:cancelled', payload);
        // 2. Notify driver (if assigned)
        if (driver_id) {
            (0, socket_1.emitToRoom)(`driver-${driver_id}`, 'job:cancelled', { job_id, reason, timestamp: ts });
            // FCM push if disconnected
            const driverConnected = (0, socket_2.findConnectedSocket)((socket) => socket.data.driverId === driver_id);
            if (!driverConnected) {
                await (0, fcm_1.sendPush)(driver_id, {
                    title: 'Job cancelled',
                    body: reason,
                }, {
                    job_id,
                    screen: 'home',
                });
            }
        }
        return { delivered: true, ts };
    });
    // POST /internal/notify/job-escalated
    // Called by orchestrator when no vehicle can be found
    app.post('/internal/notify/job-escalated', async (req) => {
        const { job_id, zone_id, reason, urgent_bins, total_weight_kg } = req.body;
        const ts = new Date().toISOString();
        const payload = {
            job_id,
            zone_id,
            reason,
            message: 'Emergency collection needs manual dispatch — no vehicle available',
            urgent_bins,
            total_weight_kg,
            timestamp: ts,
        };
        // Emit to zone and alert rooms
        (0, socket_1.emitToRoom)(`dashboard-zone-${zone_id}`, 'alert:escalated', payload);
        (0, socket_1.emitToRoom)('dashboard-all', 'alert:escalated', payload);
        (0, socket_1.emitToRoom)('alerts-all', 'alert:escalated', payload);
        return { delivered: true, ts };
    });
    // POST /internal/notify/vehicle-position
    // Called by scheduler with enriched vehicle position (immediate, non-Kafka path)
    app.post('/internal/notify/vehicle-position', async (req) => {
        const { vehicle_id, driver_id, job_id, zone_id, lat, lng, speed_kmh, cargo_weight_kg, cargo_limit_kg, cargo_utilisation_pct, bins_collected, bins_total, arrived_at_cluster, weight_limit_warning, } = req.body;
        const ts = new Date().toISOString();
        const payload = {
            vehicle_id, driver_id, job_id, zone_id, lat, lng, speed_kmh,
            cargo_weight_kg, cargo_limit_kg, cargo_utilisation_pct, bins_collected, bins_total,
            arrived_at_cluster, timestamp: ts,
        };
        // Emit vehicle position to dashboard and fleet-ops
        (0, socket_1.emitToRoom)(`dashboard-zone-${zone_id}`, 'vehicle:position', payload);
        (0, socket_1.emitToRoom)('dashboard-all', 'vehicle:position', payload);
        (0, socket_1.emitToRoom)('fleet-ops', 'vehicle:position', payload);
        // If weight limit warning, also emit alert
        if (weight_limit_warning) {
            const alertPayload = {
                vehicle_id,
                driver_id,
                cargo_utilisation_pct,
                message: `Vehicle ${vehicle_id} cargo at ${cargo_utilisation_pct}% capacity`,
                timestamp: ts,
            };
            (0, socket_1.emitToRoom)('fleet-ops', 'alert:weight-limit', alertPayload);
            (0, socket_1.emitToRoom)('dashboard-all', 'alert:weight-limit', alertPayload);
        }
        return { delivered: true, ts };
    });
    // POST /internal/notify/alert-deviation
    // Called by scheduler when vehicle is off route
    app.post('/internal/notify/alert-deviation', async (req) => {
        const { vehicle_id, driver_id, job_id, zone_id, deviation_metres, duration_seconds, message } = req.body;
        const ts = new Date().toISOString();
        const payload = {
            vehicle_id,
            driver_id,
            job_id,
            zone_id,
            deviation_metres,
            duration_seconds,
            message,
            timestamp: ts,
        };
        // Emit to fleet-ops and zone-specific rooms
        (0, socket_1.emitToRoom)('fleet-ops', 'alert:deviation', payload);
        (0, socket_1.emitToRoom)(`dashboard-zone-${zone_id}`, 'alert:deviation', payload);
        (0, socket_1.emitToRoom)('alerts-all', 'alert:deviation', payload);
        return { delivered: true, ts };
    });
}
