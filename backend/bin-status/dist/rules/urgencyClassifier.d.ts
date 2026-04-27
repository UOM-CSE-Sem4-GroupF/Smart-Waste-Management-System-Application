/**
 * Urgency Classifier — Maps fill level and urgency score to business status
 */
export type UrgencyStatus = 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline';
export interface UrgencyClassification {
    status: UrgencyStatus;
    isUrgent: boolean;
    isCritical: boolean;
}
export declare function classifyUrgency(urgencyScore: number, binStatus?: string): UrgencyClassification;
/**
 * Derive urgency score from fill level for sensors that don't provide it
 */
export declare function deriveFillBasedUrgency(fillLevelPct: number): number;
//# sourceMappingURL=urgencyClassifier.d.ts.map