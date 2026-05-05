"use strict";
/**
 * Weight Calculator — Canonical implementation for bin weight estimation
 * This is the single source of truth for weight calculation in F3.
 * All services import this function from shared-types package.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVG_KG_PER_LITRE = void 0;
exports.calculateBinWeight = calculateBinWeight;
exports.calculateBinWeightByCategory = calculateBinWeightByCategory;
exports.AVG_KG_PER_LITRE = {
    food_waste: 0.90,
    paper: 0.10,
    glass: 2.50,
    plastic: 0.05,
    general: 0.30,
    e_waste: 3.20,
};
function calculateBinWeight(fillLevelPct, volumeLitres, avgKgPerLitre) {
    if (fillLevelPct < 0 || fillLevelPct > 100) {
        throw new Error(`Invalid fill level: ${fillLevelPct}`);
    }
    return parseFloat(((fillLevelPct / 100) * volumeLitres * avgKgPerLitre).toFixed(2));
}
function calculateBinWeightByCategory(fillLevelPct, volumeLitres, wasteCategory) {
    const avgKgPerLitre = exports.AVG_KG_PER_LITRE[wasteCategory] ?? exports.AVG_KG_PER_LITRE.general;
    return calculateBinWeight(fillLevelPct, volumeLitres, avgKgPerLitre);
}
//# sourceMappingURL=weightCalculator.js.map