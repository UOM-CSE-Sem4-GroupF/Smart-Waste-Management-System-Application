/**
 * Collection Trigger — Decides whether a bin should trigger collection
 * A bin triggers collection when:
 *   - urgency_score >= 80 AND
 *   - no active collection job exists for its cluster
 */

export interface CollectionTriggerResult {
  shouldTrigger: boolean;
  reason?: string;
}

export function shouldTriggerCollection(
  urgencyScore: number,
  hasActiveJob: boolean,
): CollectionTriggerResult {
  if (urgencyScore < 80) {
    return {
      shouldTrigger: false,
      reason: 'urgency_score < 80',
    };
  }

  if (hasActiveJob) {
    return {
      shouldTrigger: false,
      reason: 'active_job_exists',
    };
  }

  return {
    shouldTrigger: true,
    reason: 'urgent_and_no_active_job',
  };
}
