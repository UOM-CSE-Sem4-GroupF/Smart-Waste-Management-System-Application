"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = vehiclesRoutes;
const store_1 = require("../store");
async function vehiclesRoutes(app) {
    // GET /api/v1/vehicles/active
    app.get('/api/v1/vehicles/active', async () => {
        const activeVehicles = [];
        for (const job of store_1.activeJobs.values()) {
            if (job.state === 'DISPATCHED' || job.state === 'IN_PROGRESS') {
                const vehicle = store_1.vehicles.get(job.assigned_vehicle_id);
                const driver = store_1.drivers.get(job.assigned_driver_id);
                if (vehicle && driver) {
                    // Calculate cargo weight (mock - would sum from bin records)
                    const cargoWeightKg = 0; // Would calculate from collected bins
                    const cargoUtilisationPct = vehicle.max_cargo_kg > 0 ? (cargoWeightKg / vehicle.max_cargo_kg) * 100 : 0;
                    activeVehicles.push({
                        vehicle_id: vehicle.vehicle_id,
                        vehicle_type: (0, store_1.getVehicleType)(vehicle.max_cargo_kg),
                        driver_id: driver.driver_id,
                        driver_name: driver.name,
                        job_id: job.job_id,
                        job_type: 'emergency', // Would determine from job data
                        zone_id: job.zone_id,
                        state: vehicle.status,
                        current_lat: vehicle.lat,
                        current_lng: vehicle.lng,
                        last_seen_at: new Date().toISOString(), // Would track from GPS updates
                        cargo_weight_kg: cargoWeightKg,
                        cargo_limit_kg: vehicle.max_cargo_kg,
                        cargo_utilisation_pct: cargoUtilisationPct,
                        bins_collected: 0, // Would count from bin records
                        bins_total: job.total_bins
                    });
                }
            }
        }
        return { vehicles: activeVehicles };
    });
}
