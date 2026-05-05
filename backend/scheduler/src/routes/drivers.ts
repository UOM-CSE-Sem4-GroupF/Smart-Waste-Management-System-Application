import { FastifyInstance } from 'fastify';
import { drivers, vehicles, getVehicleType } from '../store';
import { AvailableDriversResponse } from '../types';

export default async function driversRoutes(app: FastifyInstance) {
  // GET /api/v1/drivers/available
  app.get('/api/v1/drivers/available', async (): Promise<AvailableDriversResponse> => {
    const availableDrivers: AvailableDriversResponse['drivers'] = [];

    for (const driver of drivers.values()) {
      if (driver.status === 'available') {
        const vehicle = vehicles.get(driver.vehicle_id);

        if (vehicle) {
          availableDrivers.push({
            driver_id: driver.driver_id,
            driver_name: driver.name,
            vehicle_id: vehicle.vehicle_id,
            vehicle_type: getVehicleType(vehicle.max_cargo_kg),
            zone_id: driver.zone_id,
            status: driver.status
          });
        }
      }
    }

    return { drivers: availableDrivers };
  });
}
