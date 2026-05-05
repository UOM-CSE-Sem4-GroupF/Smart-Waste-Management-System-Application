import { WasteCategory } from './rules/weightCalculator';
import { UrgencyStatus } from './rules/urgencyClassifier';
export type { WasteCategory, UrgencyStatus };
export { AVG_KG_PER_LITRE } from './rules/weightCalculator';
export interface BinState {
    bin_id: string;
    cluster_id?: string;
    cluster_name?: string;
    zone_id: string;
    fill_level_pct: number;
    status: 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline';
    urgency_score: number;
    estimated_weight_kg: number;
    waste_category: WasteCategory;
    waste_category_colour?: string;
    fill_rate_pct_per_hour?: number;
    predicted_full_at?: string | null;
    battery_level_pct?: number;
    volume_litres: number;
    lat: number;
    lng: number;
    has_active_job?: boolean;
    collection_triggered?: boolean;
    last_reading_at: string;
    last_collected_at?: string | null;
    installed_at?: string;
    last_maintained_at?: string | null;
}
export interface KafkaEnvelope<T = Record<string, unknown>> {
    version: string;
    source_service: string;
    timestamp: string;
    payload: T;
}
export interface BinProcessedEvent {
    version: string;
    source_service: string;
    timestamp: string;
    payload: {
        bin_id: string;
        fill_level_pct: number;
        urgency_score: number;
        status: 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline';
        estimated_weight_kg: number;
        fill_rate_pct_per_hour: number;
        predicted_full_at: string | null;
        battery_level_pct: number;
    };
}
export interface ZoneStatisticsEvent {
    version: string;
    source_service: string;
    timestamp: string;
    payload: {
        zone_id: number;
        avg_fill_level_pct: number;
        urgent_bin_count: number;
        critical_bin_count: number;
        total_bins: number;
        total_estimated_weight_kg: number;
        dominant_waste_category: string;
        category_breakdown: Record<string, {
            count: number;
            avg_fill: number;
            total_kg: number;
        }>;
        window_minutes: number;
    };
}
export interface DashboardUpdateEvent<T = any> {
    version: '1.0';
    source_service: 'bin-status-service';
    timestamp: string;
    event_type: 'bin:update' | 'zone:stats' | 'alert:urgent';
    payload: T;
}
export interface BinUpdatePayload {
    bin_id: string;
    cluster_id: string;
    cluster_name: string;
    zone_id: number;
    fill_level_pct: number;
    status: string;
    urgency_score: number;
    estimated_weight_kg: number;
    waste_category: string;
    waste_category_colour: string;
    fill_rate_pct_per_hour: number;
    predicted_full_at: string | null;
    battery_level_pct: number;
    has_active_job: boolean;
    collection_triggered: boolean;
    last_collected_at: string | null;
}
export interface ZoneStatsPayload {
    zone_id: number;
    zone_name: string;
    avg_fill_level_pct: number;
    urgent_bin_count: number;
    critical_bin_count: number;
    total_bins: number;
    total_estimated_weight_kg: number;
    dominant_waste_category: string;
    category_breakdown: Record<string, {
        count: number;
        avg_fill: number;
        total_kg: number;
    }>;
    active_jobs_count: number;
    unassigned_urgent_bins: number;
}
export interface AlertPayload {
    bin_id: string;
    cluster_id: string;
    zone_id: number;
    urgency_score: number;
    waste_category: string;
    estimated_weight_kg: number;
    predicted_full_at: string | null;
    message: string;
}
export interface ClusterSnapshot {
    cluster_id: string;
    cluster_name: string;
    zone_id: number;
    lat: number;
    lng: number;
    address: string;
    total_bins: number;
    has_active_job: boolean;
    active_job_id: string | null;
    bins: Array<{
        bin_id: string;
        waste_category: string;
        fill_level_pct: number;
        status: string;
        urgency_score: number;
        estimated_weight_kg: number;
        volume_litres: number;
        avg_kg_per_litre: number;
        predicted_full_at: string | null;
        fill_rate_pct_per_hour: number;
        should_collect: boolean;
    }>;
    collectible_bins_count: number;
    collectible_bins_weight_kg: number;
    highest_urgency_score: number;
    highest_urgency_bin_id: string;
}
export interface BinDetailResponse extends BinState {
    recent_collections: Array<{
        job_id: string;
        collected_at: string;
        driver_id: string;
        fill_level_at_collection: number;
        actual_weight_kg: number | null;
        job_type: 'routine' | 'emergency';
    }>;
}
export interface BinHistoryResponse {
    bin_id: string;
    from: string;
    to: string;
    interval: string;
    series: Array<{
        timestamp: string;
        fill_level_pct: number;
        urgency_score: number;
        estimated_weight_kg: number;
    }>;
    collection_events: Array<{
        collected_at: string;
        fill_level_at_collection: number;
    }>;
}
export interface ClusterDetailResponse {
    cluster_id: string;
    cluster_name: string;
    zone_id: number;
    zone_name: string;
    lat: number;
    lng: number;
    address: string;
    bins: Array<{
        bin_id: string;
        waste_category: string;
        waste_category_colour: string;
        fill_level_pct: number;
        status: string;
        urgency_score: number;
        estimated_weight_kg: number;
        predicted_full_at: string | null;
    }>;
    summary: {
        total_bins: number;
        urgent_bins: number;
        critical_bins: number;
        total_weight_kg: number;
        highest_urgency_score: number;
        has_active_job: boolean;
        active_job_id: string | null;
    };
}
export interface ZoneSummaryResponse {
    zone_id: number;
    zone_name: string;
    total_bins: number;
    total_clusters: number;
    status_breakdown: {
        normal: number;
        monitor: number;
        urgent: number;
        critical: number;
        offline: number;
    };
    category_breakdown: Record<string, {
        total_bins: number;
        avg_fill_pct: number;
        total_weight_kg: number;
        urgent_count: number;
    }>;
    total_estimated_weight_kg: number;
    active_jobs_count: number;
    last_updated: string;
}
//# sourceMappingURL=types.d.ts.map