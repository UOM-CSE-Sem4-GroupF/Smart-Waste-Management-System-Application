import { describe, it, expect } from 'vitest';
import { shouldTriggerCollection } from '../../rules/collectionTrigger';

describe('Collection Trigger', () => {
  describe('shouldTriggerCollection', () => {
    it('triggers when urgency >= 80 and no active job', () => {
      const result = shouldTriggerCollection(85, false);
      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toBe('urgent_and_no_active_job');
    });

    it('does not trigger when urgency < 80', () => {
      const result = shouldTriggerCollection(75, false);
      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toBe('urgency_score < 80');
    });

    it('does not trigger when urgency >= 80 but active job exists', () => {
      const result = shouldTriggerCollection(85, true);
      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toBe('active_job_exists');
    });

    it('does not trigger at urgency exactly 79', () => {
      const result = shouldTriggerCollection(79, false);
      expect(result.shouldTrigger).toBe(false);
    });

    it('triggers at urgency exactly 80 with no active job', () => {
      const result = shouldTriggerCollection(80, false);
      expect(result.shouldTrigger).toBe(true);
    });

    it('does not trigger at urgency 100 if active job exists', () => {
      const result = shouldTriggerCollection(100, true);
      expect(result.shouldTrigger).toBe(false);
    });
  });
});
