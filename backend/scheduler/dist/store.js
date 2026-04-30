"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeJobs = exports.binCollectionRecords = exports.routePlans = exports.vehicles = exports.drivers = void 0;
exports.resetStore = resetStore;
exports.findAvailableVehicle = findAvailableVehicle;
exports.getVehicleType = getVehicleType;
exports.callORTools = callORTools;
exports.nearestNeighbourFallback = nearestNeighbourFallback;
const types_1 = require("./types");
const SEED_DRIVERS = [
    ['DRV-001', {
            driver_id: 'DRV-001',
            name: 'Amal Perera',
            vehicle_id: 'LORRY-01',
            zone_id: 1,
            status: 'available'
        }],
    ['DRV-002', {
            driver_id: 'DRV-002',
            name: 'Nimal Silva',
            vehicle_id: 'LORRY-02',
            zone_id: 2,
            status: 'available'
        }],
    ['DRV-003', {
            driver_id: 'DRV-003',
            name: 'Kamal Fernando',
            vehicle_id: 'LORRY-03',
            zone_id: 3,
            status: 'available'
        }],
    ['DRV-004', {
            driver_id: 'DRV-004',
            name: 'Sunil Jayawardena',
            vehicle_id: 'LORRY-04',
            zone_id: 1,
            status: 'available'
        }],
    ['DRV-005', {
            driver_id: 'DRV-005',
            name: 'Roshan Bandara',
            vehicle_id: 'LORRY-05',
            zone_id: 2,
            status: 'available'
        }],
];
const SEED_VEHICLES = [
    ['LORRY-01', {
            vehicle_id: 'LORRY-01',
            name: 'Small Lorry 01',
            max_cargo_kg: 2000,
            waste_categories_supported: ['general', 'paper', 'plastic'],
            status: 'available',
            driver_id: 'DRV-001',
            lat: 6.9271,
            lng: 79.8612,
            zone_id: 1
        }],
    ['LORRY-02', {
            vehicle_id: 'LORRY-02',
            name: 'Medium Lorry 02',
            max_cargo_kg: 8000,
            waste_categories_supported: ['glass', 'e_waste'],
            status: 'available',
            driver_id: 'DRV-002',
            lat: 6.9355,
            lng: 79.8495,
            zone_id: 2
        }],
    ['LORRY-03', {
            vehicle_id: 'LORRY-03',
            name: 'Small Lorry 03',
            max_cargo_kg: 2000,
            waste_categories_supported: ['food_waste', 'general'],
            status: 'available',
            driver_id: 'DRV-003',
            lat: 6.9215,
            lng: 79.8780,
            zone_id: 3
        }],
    ['LORRY-04', {
            vehicle_id: 'LORRY-04',
            name: 'Medium Lorry 04',
            max_cargo_kg: 8000,
            waste_categories_supported: ['general', 'food_waste', 'paper'],
            status: 'available',
            driver_id: 'DRV-004',
            lat: 6.9190,
            lng: 79.8650,
            zone_id: 1
        }],
    ['LORRY-05', {
            vehicle_id: 'LORRY-05',
            name: 'Large Lorry 05',
            max_cargo_kg: 15000,
            waste_categories_supported: ['general', 'glass', 'plastic', 'paper'],
            status: 'available',
            driver_id: 'DRV-005',
            lat: 6.9320,
            lng: 79.8700,
            zone_id: 2
        }],
];
exports.drivers = new Map(SEED_DRIVERS);
exports.vehicles = new Map(SEED_VEHICLES);
exports.routePlans = new Map();
exports.binCollectionRecords = new Map();
// In-memory job state (normally would be in database)
exports.activeJobs = new Map();
function resetStore() {
    exports.drivers.clear();
    SEED_DRIVERS.forEach(([k, v]) => exports.drivers.set(k, { ...v }));
    exports.vehicles.clear();
    SEED_VEHICLES.forEach(([k, v]) => exports.vehicles.set(k, { ...v }));
    exports.routePlans.clear();
    exports.binCollectionRecords.clear();
    exports.activeJobs.clear();
}
function findAvailableVehicle(waste_category, total_estimated_weight_kg) {
    const candidates = Array.from(exports.vehicles.values())
        .filter(v => v.status === 'available' &&
        v.waste_categories_supported.includes(waste_category) &&
        v.max_cargo_kg >= total_estimated_weight_kg)
        .sort((a, b) => a.max_cargo_kg - b.max_cargo_kg); // Smallest first
    return candidates[0];
}
function getVehicleType(max_cargo_kg) {
    if (max_cargo_kg <= 2000)
        return types_1.VehicleType.SMALL;
    if (max_cargo_kg <= 8000)
        return types_1.VehicleType.MEDIUM;
    if (max_cargo_kg <= 15000)
        return types_1.VehicleType.LARGE;
    return types_1.VehicleType.EXTRA_LARGE;
}
// Mock OR-Tools call (in real implementation, this would call the route-optimizer service)
async function callORTools(clusters, bins, availableVehicles, depot, constraints) {
    // Simple mock implementation - in real system this would call OR-Tools
    const vehicle = availableVehicles[0];
    const waypoints = bins.map((bin, index) => ({
        cluster_id: bin.cluster_id,
        bins: [bin.bin_id],
        estimated_arrival: null,
        cumulative_weight_kg: bin.estimated_weight_kg * (index + 1)
    }));
    return {
        vehicle_id: vehicle.vehicle_id,
        waypoints,
        total_distance_km: 50,
        estimated_minutes: 120
    };
}
// Fallback nearest neighbour algorithm
function nearestNeighbourFallback(bins, depot) {
    const remaining = [...bins];
    const route = [];
    let current = depot;
    let cumulativeWeight = 0;
    while (remaining.length > 0) {
        let nearestIndex = 0;
        let minDist = haversineKm(current.lat, current.lng, remaining[0].lat, remaining[0].lng);
        for (let i = 1; i < remaining.length; i++) {
            const dist = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = i;
            }
        }
        const nearest = remaining[nearestIndex];
        cumulativeWeight += nearest.estimated_weight_kg;
        route.push({
            cluster_id: nearest.cluster_id,
            bins: [nearest.bin_id],
            estimated_arrival: null,
            cumulative_weight_kg: cumulativeWeight
        });
        current = { lat: nearest.lat, lng: nearest.lng };
        remaining.splice(nearestIndex, 1);
    }
    return route;
}
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
