"use strict";
/**
 * Urgency Classifier — Maps fill level and urgency score to business status
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyUrgency = classifyUrgency;
exports.deriveFillBasedUrgency = deriveFillBasedUrgency;
function classifyUrgency(urgencyScore, binStatus) {
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
function deriveFillBasedUrgency(fillLevelPct) {
    return Math.min(100, Math.max(0, fillLevelPct));
}
//# sourceMappingURL=urgencyClassifier.js.map