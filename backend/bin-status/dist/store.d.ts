import { BinState, WasteCategory } from './types';
import { BinFilterState } from './rules/dashboardFilter';
interface ZoneCacheEntry {
    lastAvgFill: number;
    lastUrgentCount: number;
    lastCriticalCount: number;
    lastPublishedAt: number;
}
/**
 * Weight calculation
 */
export declare function calculateWeight(fillLevelPct: number, volumeLitres: number, wasteCategory: WasteCategory): number;
/**
 * Bin operations
 */
export declare function getBin(id: string): BinState | undefined;
export declare function getAllBins(): BinState[];
export declare function getBinsByZone(zoneId: string | number): BinState[];
export declare function getBinHistory(id: string): BinState[];
export declare function upsertBin(patch: Partial<BinState> & {
    bin_id: string;
}): BinState;
/**
 * Filter state operations
 */
export declare function getBinFilterState(bin_id: string): BinFilterState;
export declare function setBinFilterState(bin_id: string, state: BinFilterState): void;
/**
 * Zone cache operations
 */
export declare function getZoneCacheEntry(zone_id: number): ZoneCacheEntry | undefined;
export declare function setZoneCacheEntry(zone_id: number, entry: ZoneCacheEntry): void;
/**
 * Job tracking (mock — in production queries orchestrator)
 */
export declare function hasActiveJobForBin(bin_id: string): boolean;
export declare function getActiveJobsCountForZone(zone_id: number): number;
export declare function getUnassignedUrgentBinsInZone(zone_id: number): number;
export declare function markBinCollected(bin_id: string, collected_at: string, fillLevelAtCollection: number): BinState;
/**
 * Cleanup
 */
export declare function clearAll(): void;
export declare const store: {
    getBin: typeof getBin;
    getAllBins: typeof getAllBins;
    getBinsByZone: typeof getBinsByZone;
    getBinHistory: typeof getBinHistory;
    upsertBin: typeof upsertBin;
    calculateWeight: typeof calculateWeight;
    getBinFilterState: typeof getBinFilterState;
    setBinFilterState: typeof setBinFilterState;
    getZoneCacheEntry: typeof getZoneCacheEntry;
    setZoneCacheEntry: typeof setZoneCacheEntry;
    hasActiveJobForBin: typeof hasActiveJobForBin;
    getActiveJobsCountForZone: typeof getActiveJobsCountForZone;
    getUnassignedUrgentBinsInZone: typeof getUnassignedUrgentBinsInZone;
    markBinCollected: typeof markBinCollected;
    clearAll: typeof clearAll;
};
export {};
//# sourceMappingURL=store.d.ts.map