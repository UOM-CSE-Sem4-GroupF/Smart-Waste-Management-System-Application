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
    lastPushedAt?: number;
    lastFillLevel?: number;
}
export interface DashboardFilterResult {
    shouldPush: boolean;
    reason: string;
}
export declare function shouldPushToDashboard(current: {
    status: string;
    urgencyScore: number;
    fillLevelPct: number;
    batteryLevelPct?: number;
    hasActiveJob?: boolean;
}, previous: BinFilterState): DashboardFilterResult;
/**
 * Update filter state after pushing
 */
export declare function updateFilterState(state: BinFilterState, current: {
    status: string;
    urgencyScore: number;
    fillLevelPct: number;
}): BinFilterState;
//# sourceMappingURL=dashboardFilter.d.ts.map