import { describe, it, expect, beforeEach } from 'vitest';
import { shouldPushToDashboard, updateFilterState, BinFilterState } from '../../rules/dashboardFilter';

describe('Dashboard Filter', () => {
  let previousState: BinFilterState;

  beforeEach(() => {
    previousState = {};
  });

  describe('shouldPushToDashboard — always push', () => {
    it('pushes when bin is offline', () => {
      const result = shouldPushToDashboard(
        {
          status: 'offline',
          urgencyScore: 50,
          fillLevelPct: 50,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(true);
      expect(result.reason).toBe('status_offline');
    });

    it('pushes when status changed', () => {
      previousState = { lastStatus: 'normal' };
      const result = shouldPushToDashboard(
        {
          status: 'urgent',
          urgencyScore: 80,
          fillLevelPct: 80,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(true);
      expect(result.reason).toBe('status_changed');
    });

    it('pushes when urgency >= 80', () => {
      const result = shouldPushToDashboard(
        {
          status: 'normal',
          urgencyScore: 85,
          fillLevelPct: 85,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(true);
      expect(result.reason).toBe('urgency_score_critical');
    });

    it('pushes when battery < 10%', () => {
      previousState = { lastStatus: 'normal' };
      const result = shouldPushToDashboard(
        {
          status: 'normal',
          urgencyScore: 50,
          fillLevelPct: 50,
          batteryLevelPct: 8,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(true);
      expect(result.reason).toBe('battery_low');
    });
  });

  describe('shouldPushToDashboard — suppress', () => {
    it('suppresses when bin has active job', () => {
      const result = shouldPushToDashboard(
        {
          status: 'urgent',
          urgencyScore: 85,
          fillLevelPct: 85,
          hasActiveJob: true,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(false);
      expect(result.reason).toBe('has_active_job');
    });

    it('suppresses when fill level change < 1% and status unchanged', () => {
      previousState = { lastStatus: 'normal', lastFillLevel: 50 };
      const result = shouldPushToDashboard(
        {
          status: 'normal',
          urgencyScore: 50,
          fillLevelPct: 50.5,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(false);
      expect(result.reason).toBe('minimal_fill_change_and_status_unchanged');
    });
  });

  describe('shouldPushToDashboard — throttle', () => {
    it('throttles normal status if pushed < 60 seconds ago', () => {
      previousState = {
        lastStatus: 'normal',
        lastPushedAt: Date.now() - 30 * 1000, // 30 seconds ago
      };
      const result = shouldPushToDashboard(
        {
          status: 'normal',
          urgencyScore: 30,
          fillLevelPct: 30,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(false);
      expect(result.reason).toBe('throttled_normal_or_monitor');
    });

    it('allows normal status if pushed > 60 seconds ago', () => {
      previousState = {
        lastStatus: 'normal',
        lastPushedAt: Date.now() - 61 * 1000, // 61 seconds ago
      };
      const result = shouldPushToDashboard(
        {
          status: 'normal',
          urgencyScore: 30,
          fillLevelPct: 30,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(true);
      expect(result.reason).toBe('normal_or_monitor_after_throttle');
    });

    it('throttles monitor status if pushed < 60 seconds ago', () => {
      previousState = {
        lastStatus: 'monitor',
        lastPushedAt: Date.now() - 45 * 1000,
      };
      const result = shouldPushToDashboard(
        {
          status: 'monitor',
          urgencyScore: 60,
          fillLevelPct: 60,
        },
        previousState,
      );
      expect(result.shouldPush).toBe(false);
    });
  });

  describe('updateFilterState', () => {
    it('updates all filter state fields', () => {
      const updated = updateFilterState(previousState, {
        status: 'urgent',
        urgencyScore: 85,
        fillLevelPct: 85,
      });

      expect(updated.lastStatus).toBe('urgent');
      expect(updated.lastUrgencyScore).toBe(85);
      expect(updated.lastFillLevel).toBe(85);
      expect(updated.lastPushedAt).toBeDefined();
    });
  });
});
