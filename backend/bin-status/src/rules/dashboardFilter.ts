/**
 * Dashboard Filter — Smart filtering for bin updates
 * Decides whether an update should be pushed to the dashboard
 *
 * ALWAYS push:
 *   - status changed from previous
 *   - urgency_score >= 80
 *   - battery_level_pct < 10 (low battery alert)
 *   - status = 'offline'
 *
 * THROTTLE (max 1 push per 60 seconds per bin):
 *   - status unchanged AND status = 'normal'
 *   - status unchanged AND status = 'monitor'
 *
 * SUPPRESS:
 *   - fill_level_pct changed by < 1% AND status unchanged
 *   - bin has active job already in progress
 */

export interface BinFilterState {
  lastStatus?: string;
  lastUrgencyScore?: number;
  lastPushedAt?: number; // timestamp ms
  lastFillLevel?: number;
}

export interface DashboardFilterResult {
  shouldPush: boolean;
  reason: string;
}

const THROTTLE_SECONDS = 60;
const FILL_CHANGE_THRESHOLD = 1; // %

export function shouldPushToDashboard(
  current: {
    status: string;
    urgencyScore: number;
    fillLevelPct: number;
    batteryLevelPct?: number;
    hasActiveJob?: boolean;
  },
  previous: BinFilterState,
): DashboardFilterResult {
  const now = Date.now();

  // SUPPRESS: bin has active job in progress
  if (current.hasActiveJob) {
    return {
      shouldPush: false,
      reason: 'has_active_job',
    };
  }

  // ALWAYS push: bin is offline
  if (current.status === 'offline') {
    return {
      shouldPush: true,
      reason: 'status_offline',
    };
  }

  // ALWAYS push: status changed
  if (previous.lastStatus && previous.lastStatus !== current.status) {
    return {
      shouldPush: true,
      reason: 'status_changed',
    };
  }

  // ALWAYS push: urgency >= 80
  if (current.urgencyScore >= 80) {
    return {
      shouldPush: true,
      reason: 'urgency_score_critical',
    };
  }

  // ALWAYS push: low battery alert
  if (current.batteryLevelPct !== undefined && current.batteryLevelPct < 10) {
    return {
      shouldPush: true,
      reason: 'battery_low',
    };
  }

  // SUPPRESS: fill level changed by < 1% and status unchanged
  if (
    previous.lastFillLevel !== undefined &&
    Math.abs(current.fillLevelPct - previous.lastFillLevel) < FILL_CHANGE_THRESHOLD &&
    previous.lastStatus === current.status
  ) {
    return {
      shouldPush: false,
      reason: 'minimal_fill_change_and_status_unchanged',
    };
  }

  // THROTTLE: status unchanged and status = 'normal' or 'monitor'
  if (
    previous.lastStatus === current.status &&
    (current.status === 'normal' || current.status === 'monitor')
  ) {
    const timeSinceLastPush = previous.lastPushedAt ? now - previous.lastPushedAt : Infinity;
    const throttleMs = THROTTLE_SECONDS * 1000;

    if (timeSinceLastPush < throttleMs) {
      return {
        shouldPush: false,
        reason: 'throttled_normal_or_monitor',
      };
    }

    return {
      shouldPush: true,
      reason: 'normal_or_monitor_after_throttle',
    };
  }

  // Default: push
  return {
    shouldPush: true,
    reason: 'default_push',
  };
}

/**
 * Update filter state after pushing
 */
export function updateFilterState(
  state: BinFilterState,
  current: {
    status: string;
    urgencyScore: number;
    fillLevelPct: number;
  },
): BinFilterState {
  return {
    lastStatus: current.status,
    lastUrgencyScore: current.urgencyScore,
    lastFillLevel: current.fillLevelPct,
    lastPushedAt: Date.now(),
  };
}
