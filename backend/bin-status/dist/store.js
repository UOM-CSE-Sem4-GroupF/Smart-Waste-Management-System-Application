"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
exports.calculateWeight = calculateWeight;
exports.getBin = getBin;
exports.getAllBins = getAllBins;
exports.getBinsByZone = getBinsByZone;
exports.getBinHistory = getBinHistory;
exports.upsertBin = upsertBin;
exports.getBinFilterState = getBinFilterState;
exports.setBinFilterState = setBinFilterState;
exports.getZoneCacheEntry = getZoneCacheEntry;
exports.setZoneCacheEntry = setZoneCacheEntry;
exports.hasActiveJobForBin = hasActiveJobForBin;
exports.getActiveJobsCountForZone = getActiveJobsCountForZone;
exports.getUnassignedUrgentBinsInZone = getUnassignedUrgentBinsInZone;
exports.markBinCollected = markBinCollected;
exports.clearAll = clearAll;
const types_1 = require("./types");
const ZONE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Core stores
const bins = new Map();
const history = new Map();
const filterState = new Map();
const zoneCache = new Map();
// Mock data for collection jobs (in production, comes from orchestrator service)
const activeJobs = new Map();
// Seed data so the dashboard shows something without Kafka
const SEED_BINS = [
    {
        bin_id: 'BIN-001',
        fill_level_pct: 87,
        urgency_score: 87,
        status: 'critical',
        estimated_weight_kg: 62.6,
        waste_category: 'general',
        volume_litres: 240,
        zone_id: 'Zone-1',
        lat: 6.9271,
        lng: 79.8612,
        last_reading_at: new Date().toISOString(),
    },
    {
        bin_id: 'BIN-002',
        fill_level_pct: 62,
        urgency_score: 62,
        status: 'monitor',
        estimated_weight_kg: 14.9,
        waste_category: 'plastic',
        volume_litres: 120,
        zone_id: 'Zone-1',
        lat: 6.9285,
        lng: 79.8640,
        last_reading_at: new Date().toISOString(),
    },
];
SEED_BINS.forEach((b) => bins.set(b.bin_id, b));
/**
 * Weight calculation
 */
function calculateWeight(fillLevelPct, volumeLitres, wasteCategory) {
    const density = types_1.AVG_KG_PER_LITRE[wasteCategory] ?? types_1.AVG_KG_PER_LITRE.general;
    return parseFloat(((fillLevelPct / 100) * volumeLitres * density).toFixed(2));
}
/**
 * Bin operations
 */
function getBin(id) {
    return bins.get(id);
}
function getAllBins() {
    return [...bins.values()];
}
function getBinsByZone(zoneId) {
    return [...bins.values()].filter((b) => b.zone_id === String(zoneId));
}
function getBinHistory(id) {
    return history.get(id) ?? [];
}
function upsertBin(patch) {
    const existing = bins.get(patch.bin_id);
    const waste_category = patch.waste_category ?? existing?.waste_category ?? 'general';
    const volume_litres = patch.volume_litres ?? existing?.volume_litres ?? 240;
    const fill_level_pct = patch.fill_level_pct ?? existing?.fill_level_pct ?? 0;
    const estimated_weight_kg = patch.estimated_weight_kg ?? calculateWeight(fill_level_pct, volume_litres, waste_category);
    const next = {
        bin_id: patch.bin_id,
        fill_level_pct,
        urgency_score: patch.urgency_score ?? existing?.urgency_score ?? 0,
        status: patch.status ?? existing?.status ?? 'normal',
        estimated_weight_kg,
        waste_category,
        volume_litres,
        zone_id: patch.zone_id ?? existing?.zone_id ?? 'unknown',
        lat: patch.lat ?? existing?.lat ?? 0,
        lng: patch.lng ?? existing?.lng ?? 0,
        cluster_id: patch.cluster_id ?? existing?.cluster_id,
        cluster_name: patch.cluster_name ?? existing?.cluster_name,
        has_active_job: patch.has_active_job ?? existing?.has_active_job,
        last_reading_at: patch.last_reading_at ?? new Date().toISOString(),
        last_collected_at: patch.last_collected_at ?? existing?.last_collected_at,
    };
    // Keep history
    if (existing) {
        const hist = history.get(patch.bin_id) ?? [];
        hist.push(existing);
        if (hist.length > 100)
            hist.shift();
        history.set(patch.bin_id, hist);
    }
    bins.set(patch.bin_id, next);
    return next;
}
/**
 * Filter state operations
 */
function getBinFilterState(bin_id) {
    return filterState.get(bin_id) ?? {};
}
function setBinFilterState(bin_id, state) {
    filterState.set(bin_id, state);
}
/**
 * Zone cache operations
 */
function getZoneCacheEntry(zone_id) {
    const entry = zoneCache.get(zone_id);
    if (!entry)
        return undefined;
    // Check TTL
    if (Date.now() - entry.lastPublishedAt > ZONE_CACHE_TTL_MS) {
        zoneCache.delete(zone_id);
        return undefined;
    }
    return entry;
}
function setZoneCacheEntry(zone_id, entry) {
    zoneCache.set(zone_id, entry);
}
/**
 * Job tracking (mock — in production queries orchestrator)
 */
function hasActiveJobForBin(bin_id) {
    for (const job of activeJobs.values()) {
        if (job.bin_ids.includes(bin_id)) {
            return true;
        }
    }
    return false;
}
function getActiveJobsCountForZone(zone_id) {
    let count = 0;
    for (const job of activeJobs.values()) {
        if (job.zone_id === zone_id) {
            count++;
        }
    }
    return count;
}
function getUnassignedUrgentBinsInZone(zone_id) {
    const zoneseBins = getBinsByZone(zone_id);
    return zoneseBins.filter((b) => b.urgency_score >= 80 && !b.has_active_job).length;
}
function markBinCollected(bin_id, collected_at, fillLevelAtCollection) {
    const bin = getBin(bin_id);
    if (!bin) {
        throw new Error(`Bin ${bin_id} not found`);
    }
    return upsertBin({
        bin_id,
        fill_level_pct: fillLevelAtCollection ?? 0,
        urgency_score: 0,
        status: 'normal',
        last_collected_at: collected_at,
    });
}
/**
 * Cleanup
 */
function clearAll() {
    bins.clear();
    history.clear();
    filterState.clear();
    zoneCache.clear();
}
// Export as singleton
exports.store = {
    getBin,
    getAllBins,
    getBinsByZone,
    getBinHistory,
    upsertBin,
    calculateWeight,
    getBinFilterState,
    setBinFilterState,
    getZoneCacheEntry,
    setZoneCacheEntry,
    hasActiveJobForBin,
    getActiveJobsCountForZone,
    getUnassignedUrgentBinsInZone,
    markBinCollected,
    clearAll,
};
//# sourceMappingURL=store.js.map