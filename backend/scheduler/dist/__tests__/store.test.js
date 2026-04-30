"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const store_1 = require("../store");
(0, vitest_1.beforeEach)(() => (0, store_1.resetStore)());
(0, vitest_1.describe)('findAvailableDriver', () => {
    (0, vitest_1.it)('prefers a same-zone driver', () => {
        const driver = (0, store_1.findAvailableDriver)('Zone-2');
        (0, vitest_1.expect)(driver?.zone_id).toBe('Zone-2');
    });
    (0, vitest_1.it)('falls back to any available driver when no zone match', () => {
        // mark all Zone-X drivers unavailable except one from a different zone
        store_1.drivers.forEach(d => { if (d.zone_id !== 'Zone-1')
            d.available = false; });
        const driver = (0, store_1.findAvailableDriver)('Zone-3');
        (0, vitest_1.expect)(driver).toBeDefined();
        (0, vitest_1.expect)(driver?.zone_id).toBe('Zone-1');
    });
    (0, vitest_1.it)('returns undefined when all drivers are unavailable', () => {
        store_1.drivers.forEach(d => { d.available = false; });
        (0, vitest_1.expect)((0, store_1.findAvailableDriver)('Zone-1')).toBeUndefined();
    });
    (0, vitest_1.it)('excludes specified driver ids', () => {
        const exclude = [...store_1.drivers.keys()].slice(0, 4); // exclude all but last
        const driver = (0, store_1.findAvailableDriver)('Zone-1', exclude);
        (0, vitest_1.expect)(driver).toBeDefined();
        (0, vitest_1.expect)(exclude).not.toContain(driver.driver_id);
    });
});
(0, vitest_1.describe)('findAvailableVehicle', () => {
    (0, vitest_1.it)('finds a vehicle that supports the category', () => {
        const v = (0, store_1.findAvailableVehicle)('glass', 100);
        (0, vitest_1.expect)(v).toBeDefined();
        (0, vitest_1.expect)(v?.waste_categories).toContain('glass');
    });
    (0, vitest_1.it)('returns undefined for unsupported category', () => {
        (0, vitest_1.expect)((0, store_1.findAvailableVehicle)('radioactive', 100)).toBeUndefined();
    });
    (0, vitest_1.it)('ignores unavailable vehicles', () => {
        store_1.vehicles.forEach(v => { v.available = false; });
        (0, vitest_1.expect)((0, store_1.findAvailableVehicle)('general', 100)).toBeUndefined();
    });
});
(0, vitest_1.describe)('assignJob', () => {
    (0, vitest_1.it)('marks driver and vehicle as unavailable and creates progress entry', () => {
        const progress = (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        (0, vitest_1.expect)(progress.job_id).toBe('JOB-1');
        (0, vitest_1.expect)(progress.current_cargo_kg).toBe(0);
        (0, vitest_1.expect)(store_1.drivers.get('DRV-001').available).toBe(false);
        (0, vitest_1.expect)(store_1.vehicles.get('LORRY-01').available).toBe(false);
        (0, vitest_1.expect)(store_1.jobProgress.get('JOB-1')).toBeDefined();
    });
});
(0, vitest_1.describe)('releaseJob', () => {
    (0, vitest_1.it)('frees driver and vehicle after job release', () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        (0, store_1.releaseJob)('JOB-1');
        (0, vitest_1.expect)(store_1.drivers.get('DRV-001').available).toBe(true);
        (0, vitest_1.expect)(store_1.vehicles.get('LORRY-01').available).toBe(true);
    });
    (0, vitest_1.it)('is a no-op for unknown job_id', () => {
        (0, vitest_1.expect)(() => (0, store_1.releaseJob)('NOPE')).not.toThrow();
    });
});
(0, vitest_1.describe)('recordBinCollected', () => {
    (0, vitest_1.it)('adds a collected entry and increments cargo', () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        const ok = (0, store_1.recordBinCollected)('JOB-1', 'B1', 120);
        (0, vitest_1.expect)(ok).toBe(true);
        const p = store_1.jobProgress.get('JOB-1');
        (0, vitest_1.expect)(p.bin_statuses[0].status).toBe('collected');
        (0, vitest_1.expect)(p.current_cargo_kg).toBe(120);
    });
    (0, vitest_1.it)('returns false for unknown job', () => {
        (0, vitest_1.expect)((0, store_1.recordBinCollected)('NOPE', 'B1', 100)).toBe(false);
    });
});
(0, vitest_1.describe)('recordBinSkipped', () => {
    (0, vitest_1.it)('adds a skipped entry with reason', () => {
        (0, store_1.assignJob)('JOB-1', 'DRV-001', 'LORRY-01', 500);
        const ok = (0, store_1.recordBinSkipped)('JOB-1', 'B1', 'blocked road');
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(store_1.jobProgress.get('JOB-1').bin_statuses[0]).toMatchObject({ status: 'skipped', skipped_reason: 'blocked road' });
    });
    (0, vitest_1.it)('returns false for unknown job', () => {
        (0, vitest_1.expect)((0, store_1.recordBinSkipped)('NOPE', 'B1', 'reason')).toBe(false);
    });
});
