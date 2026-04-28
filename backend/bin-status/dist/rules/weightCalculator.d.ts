/**
 * Weight Calculator — Canonical implementation for bin weight estimation
 * This is the single source of truth for weight calculation in F3.
 * All services import this function from shared-types package.
 */
export type WasteCategory = 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste';
export declare const AVG_KG_PER_LITRE: Record<WasteCategory, number>;
export declare function calculateBinWeight(fillLevelPct: number, volumeLitres: number, avgKgPerLitre: number): number;
export declare function calculateBinWeightByCategory(fillLevelPct: number, volumeLitres: number, wasteCategory: WasteCategory): number;
//# sourceMappingURL=weightCalculator.d.ts.map