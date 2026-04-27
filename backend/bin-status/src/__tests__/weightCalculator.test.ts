import { describe, it, expect } from 'vitest';
import { calculateBinWeight, calculateBinWeightByCategory, AVG_KG_PER_LITRE } from '../../rules/weightCalculator';

describe('Weight Calculator', () => {
  describe('calculateBinWeight', () => {
    it('calculates weight for glass bin: 240L at 85% → 510 kg', () => {
      expect(calculateBinWeight(85, 240, AVG_KG_PER_LITRE.glass)).toBe(510);
    });

    it('calculates weight for plastic bin: 120L at 100% → 6 kg', () => {
      expect(calculateBinWeight(100, 120, AVG_KG_PER_LITRE.plastic)).toBe(6);
    });

    it('calculates weight for food_waste bin: 240L at 50% → 108 kg', () => {
      expect(calculateBinWeight(50, 240, AVG_KG_PER_LITRE.food_waste)).toBe(108);
    });

    it('returns 0 for empty bin', () => {
      expect(calculateBinWeight(0, 240, AVG_KG_PER_LITRE.general)).toBe(0);
    });

    it('throws error for invalid fill level > 100', () => {
      expect(() => calculateBinWeight(101, 240, AVG_KG_PER_LITRE.general)).toThrow();
    });

    it('throws error for invalid fill level < 0', () => {
      expect(() => calculateBinWeight(-1, 240, AVG_KG_PER_LITRE.general)).toThrow();
    });

    it('rounds to 2 decimal places', () => {
      expect(calculateBinWeight(33, 240, AVG_KG_PER_LITRE.plastic)).toBe(3.96);
    });
  });

  describe('calculateBinWeightByCategory', () => {
    it('uses correct density for waste_category=glass', () => {
      const weight = calculateBinWeightByCategory(100, 100, 'glass');
      expect(weight).toBe(250);
    });

    it('uses correct density for waste_category=paper', () => {
      const weight = calculateBinWeightByCategory(100, 1000, 'paper');
      expect(weight).toBe(100);
    });

    it('uses correct density for waste_category=e_waste', () => {
      const weight = calculateBinWeightByCategory(50, 100, 'e_waste');
      expect(weight).toBe(160);
    });
  });
});
