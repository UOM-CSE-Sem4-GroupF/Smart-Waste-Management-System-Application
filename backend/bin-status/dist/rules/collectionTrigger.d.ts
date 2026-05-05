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
export declare function shouldTriggerCollection(urgencyScore: number, hasActiveJob: boolean): CollectionTriggerResult;
//# sourceMappingURL=collectionTrigger.d.ts.map