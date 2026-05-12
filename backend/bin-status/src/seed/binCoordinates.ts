import { store } from '../store';

/**
 * Real-world Colombo coordinates for each deployed bin.
 * Called once at startup so the in-memory store always has valid lat/lng
 * before the first Kafka message arrives.
 */
const BIN_COORDINATES: Record<string, { lat: number; lng: number; cluster_id: string; cluster_name: string; zone_id: string }> = {
  'BIN-001': { lat: 6.9344, lng: 79.8428, cluster_id: 'CLUSTER-001', cluster_name: 'Central Market',        zone_id: '1' },
  'BIN-002': { lat: 6.9338, lng: 79.8435, cluster_id: 'CLUSTER-001', cluster_name: 'Central Market',        zone_id: '1' },
  'BIN-003': { lat: 6.9357, lng: 79.8518, cluster_id: 'CLUSTER-002', cluster_name: 'Pettah Bus Terminal',   zone_id: '1' },
  'BIN-004': { lat: 6.9271, lng: 79.8612, cluster_id: 'CLUSTER-003', cluster_name: 'Maradana Apartments',   zone_id: '2' },
  'BIN-005': { lat: 6.9189, lng: 79.8598, cluster_id: 'CLUSTER-004', cluster_name: 'Norris Canal Road',     zone_id: '2' },
  'BIN-006': { lat: 6.9231, lng: 79.8798, cluster_id: 'CLUSTER-005', cluster_name: 'Dematagoda Glass Hub',  zone_id: '2' },
  'BIN-007': { lat: 6.8832, lng: 79.8601, cluster_id: 'CLUSTER-006', cluster_name: 'Wellawatte Market',     zone_id: '3' },
  'BIN-008': { lat: 6.8972, lng: 79.8587, cluster_id: 'CLUSTER-007', cluster_name: 'Bambalapitiya Flats',   zone_id: '3' },
  'BIN-009': { lat: 6.9160, lng: 79.8992, cluster_id: 'CLUSTER-008', cluster_name: 'Rajagiriya Glass Hub',  zone_id: '4' },
  'BIN-010': { lat: 6.9013, lng: 79.9128, cluster_id: 'CLUSTER-009', cluster_name: 'Kotte Town Centre',     zone_id: '4' },
};

export function seedBinCoordinates(): void {
  for (const [bin_id, meta] of Object.entries(BIN_COORDINATES)) {
    const existing = store.getBin(bin_id);
    if (!existing || existing.lat === 0) {
      store.upsertBin({
        bin_id,
        lat: meta.lat,
        lng: meta.lng,
        cluster_id: meta.cluster_id,
        cluster_name: meta.cluster_name,
        zone_id: meta.zone_id,
        fill_level_pct: existing?.fill_level_pct ?? 0,
        urgency_score: existing?.urgency_score ?? 0,
        status: existing?.status ?? 'normal',
        last_reading_at: existing?.last_reading_at ?? new Date().toISOString(),
      });
    }
  }
}
