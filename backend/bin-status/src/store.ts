import { BinState, WasteCategory, AVG_KG_PER_LITRE } from './types';
import { BinFilterState } from './rules/dashboardFilter';

const ZONE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface ZoneCacheEntry {
  lastAvgFill: number;
  lastUrgentCount: number;
  lastCriticalCount: number;
  lastPublishedAt: number;
}

// Core stores
const bins = new Map<string, BinState>();
const history = new Map<string, BinState[]>();
const filterState = new Map<string, BinFilterState>();
const zoneCache = new Map<number, ZoneCacheEntry>();

// Mock data for collection jobs (in production, comes from orchestrator service)
const activeJobs = new Map<string, { job_id: string; bin_ids: string[]; zone_id: number }>();

// Seed data so the dashboard shows something without Kafka
const SEED_BINS: BinState[] = [
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
export function calculateWeight(
  fillLevelPct: number,
  volumeLitres: number,
  wasteCategory: WasteCategory,
): number {
  const density = AVG_KG_PER_LITRE[wasteCategory] ?? AVG_KG_PER_LITRE.general;
  return parseFloat(((fillLevelPct / 100) * volumeLitres * density).toFixed(2));
}

/**
 * Bin operations
 */
export function getBin(id: string): BinState | undefined {
  return bins.get(id);
}

export function getAllBins(): BinState[] {
  return [...bins.values()];
}

export function getBinsByZone(zoneId: string | number): BinState[] {
  return [...bins.values()].filter((b) => b.zone_id === String(zoneId));
}

export function getBinHistory(id: string): BinState[] {
  return history.get(id) ?? [];
}

export function upsertBin(patch: Partial<BinState> & { bin_id: string }): BinState {
  const existing = bins.get(patch.bin_id);

  const waste_category = patch.waste_category ?? existing?.waste_category ?? 'general';
  const volume_litres = patch.volume_litres ?? existing?.volume_litres ?? 240;
  const fill_level_pct = patch.fill_level_pct ?? existing?.fill_level_pct ?? 0;

  const estimated_weight_kg =
    patch.estimated_weight_kg ?? calculateWeight(fill_level_pct, volume_litres, waste_category);

  const next: BinState = {
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
    if (hist.length > 100) hist.shift();
    history.set(patch.bin_id, hist);
  }

  bins.set(patch.bin_id, next);
  return next;
}

/**
 * Filter state operations
 */
export function getBinFilterState(bin_id: string): BinFilterState {
  return filterState.get(bin_id) ?? {};
}

export function setBinFilterState(bin_id: string, state: BinFilterState): void {
  filterState.set(bin_id, state);
}

/**
 * Zone cache operations
 */
export function getZoneCacheEntry(zone_id: number): ZoneCacheEntry | undefined {
  const entry = zoneCache.get(zone_id);
  if (!entry) return undefined;

  // Check TTL
  if (Date.now() - entry.lastPublishedAt > ZONE_CACHE_TTL_MS) {
    zoneCache.delete(zone_id);
    return undefined;
  }

  return entry;
}

export function setZoneCacheEntry(zone_id: number, entry: ZoneCacheEntry): void {
  zoneCache.set(zone_id, entry);
}

/**
 * Job tracking (mock — in production queries orchestrator)
 */
export function hasActiveJobForBin(bin_id: string): boolean {
  for (const job of activeJobs.values()) {
    if (job.bin_ids.includes(bin_id)) {
      return true;
    }
  }
  return false;
}

export function getActiveJobsCountForZone(zone_id: number): number {
  let count = 0;
  for (const job of activeJobs.values()) {
    if (job.zone_id === zone_id) {
      count++;
    }
  }
  return count;
}

export function getUnassignedUrgentBinsInZone(zone_id: number): number {
  const zoneseBins = getBinsByZone(zone_id);
  return zoneseBins.filter((b) => b.urgency_score >= 80 && !b.has_active_job).length;
}

export function markBinCollected(
  bin_id: string,
  collected_at: string,
  fillLevelAtCollection: number,
): BinState {
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
export function clearAll(): void {
  bins.clear();
  history.clear();
  filterState.clear();
  zoneCache.clear();
}

// Export as singleton
export const store = {
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
