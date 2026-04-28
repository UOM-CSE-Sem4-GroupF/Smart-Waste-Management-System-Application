"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = driversRoutes;
const store_1 = require("../store");
async function driversRoutes(app) {
    // GET /api/v1/drivers/available
    app.get('/api/v1/drivers/available', async () => {
        const availableDrivers = [];
        for (const driver of store_1.drivers.values()) {
            if (driver.status === 'available') {
                const vehicle = store_1.vehicles.get(driver.vehicle_id);
                if (vehicle) {
                    availableDrivers.push({
                        driver_id: driver.driver_id,
                        driver_name: driver.name,
                        vehicle_id: vehicle.vehicle_id,
                        vehicle_type: (0, store_1.getVehicleType)(vehicle.max_cargo_kg),
                        zone_id: driver.zone_id,
                        status: driver.status
                    });
                }
            }
        }
        return { drivers: availableDrivers };
    });
}
