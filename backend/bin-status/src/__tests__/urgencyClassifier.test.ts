import { describe, it, expect } from 'vitest';
import { classifyUrgency } from '../../rules/urgencyClassifier';

describe('Urgency Classifier', () => {
  describe('classifyUrgency', () => {
    it('classifies 0% as normal', () => {
      const result = classifyUrgency(0);
      expect(result.status).toBe('normal');
      expect(result.isUrgent).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('classifies 60% as monitor', () => {
      const result = classifyUrgency(60);
      expect(result.status).toBe('monitor');
      expect(result.isUrgent).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('classifies 80% as urgent', () => {
      const result = classifyUrgency(80);
      expect(result.status).toBe('urgent');
      expect(result.isUrgent).toBe(true);
      expect(result.isCritical).toBe(false);
    });

    it('classifies 90% as critical', () => {
      const result = classifyUrgency(90);
      expect(result.status).toBe('critical');
      expect(result.isUrgent).toBe(true);
      expect(result.isCritical).toBe(true);
    });

    it('classifies 100% as critical', () => {
      const result = classifyUrgency(100);
      expect(result.status).toBe('critical');
      expect(result.isUrgent).toBe(true);
      expect(result.isCritical).toBe(true);
    });

    it('respects offline status', () => {
      const result = classifyUrgency(99, 'offline');
      expect(result.status).toBe('offline');
      expect(result.isUrgent).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('handles edge case: urgency=79 as monitor', () => {
      const result = classifyUrgency(79);
      expect(result.status).toBe('monitor');
      expect(result.isUrgent).toBe(false);
    });

    it('handles edge case: urgency=65 as monitor', () => {
      const result = classifyUrgency(65);
      expect(result.status).toBe('monitor');
    });

    it('handles edge case: urgency=64 as normal', () => {
      const result = classifyUrgency(64);
      expect(result.status).toBe('normal');
    });
  });
});
