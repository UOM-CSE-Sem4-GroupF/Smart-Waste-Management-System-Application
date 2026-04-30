export interface AuditPayload {
  job_id:             string;
  job_type:           string;
  zone_id:            string;
  driver_id?:         string;
  vehicle_id?:        string;
  bins_collected:     Array<{ bin_id: string; collected_at?: string; actual_weight_kg?: number }>;
  total_weight_kg:    number;
  route_distance_km:  number;
  started_at?:        string;
  completed_at:       string;
  gps_trail_hash?:    string;
}

export interface AuditResult {
  tx_id: string;
}

// Stub — F4 provides the real Hyperledger Fabric client
export async function recordAudit(payload: AuditPayload): Promise<AuditResult> {
  return { tx_id: `stub-${payload.job_id}-${Date.now()}` };
}
