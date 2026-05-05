/**
 * Weight Calculator — Canonical implementation for bin weight estimation
 * This is the single source of truth for weight calculation in F3.
 * All services import this function from shared-types package.
 */

export type WasteCategory = 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste';

export const AVG_KG_PER_LITRE: Record<WasteCategory, number> = {
  food_waste: 0.90,
  paper: 0.10,
  glass: 2.50,
  plastic: 0.05,
  general: 0.30,
  e_waste: 3.20,
};

export function calculateBinWeight(
  fillLevelPct: number,
  volumeLitres: number,
  avgKgPerLitre: number,
): number {
  if (fillLevelPct < 0 || fillLevelPct > 100) {
    throw new Error(`Invalid fill level: ${fillLevelPct}`);
  }
  return parseFloat(((fillLevelPct / 100) * volumeLitres * avgKgPerLitre).toFixed(2));
}

export function calculateBinWeightByCategory(
  fillLevelPct: number,
  volumeLitres: number,
  wasteCategory: WasteCategory,
): number {
  const avgKgPerLitre = AVG_KG_PER_LITRE[wasteCategory] ?? AVG_KG_PER_LITRE.general;
  return calculateBinWeight(fillLevelPct, volumeLitres, avgKgPerLitre);
}
