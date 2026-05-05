/**
 * Urgency Classifier — Maps fill level and urgency score to business status
 */

export type UrgencyStatus = 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline';

export interface UrgencyClassification {
  status: UrgencyStatus;
  isUrgent: boolean; // true if urgency_score >= 80
  isCritical: boolean; // true if urgency_score >= 90
}

export function classifyUrgency(urgencyScore: number, binStatus?: string): UrgencyClassification {
  // If bin is offline, always classify as offline
  if (binStatus === 'offline') {
    return {
      status: 'offline',
      isUrgent: false,
      isCritical: false,
    };
  }

  // Otherwise classify based on urgency score
  if (urgencyScore >= 90) {
    return {
      status: 'critical',
      isUrgent: true,
      isCritical: true,
    };
  }

  if (urgencyScore >= 80) {
    return {
      status: 'urgent',
      isUrgent: true,
      isCritical: false,
    };
  }

  if (urgencyScore >= 65) {
    return {
      status: 'monitor',
      isUrgent: false,
      isCritical: false,
    };
  }

  return {
    status: 'normal',
    isUrgent: false,
    isCritical: false,
  };
}

/**
 * Derive urgency score from fill level for sensors that don't provide it
 */
export function deriveFillBasedUrgency(fillLevelPct: number): number {
  return Math.min(100, Math.max(0, fillLevelPct));
}
