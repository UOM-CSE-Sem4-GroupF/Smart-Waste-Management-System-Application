import pino from 'pino';

const logger = pino();
// Since core-api is in the DataAnalysis network (waste-network), 
// and kong is in the garabadge network, 
// we assume Kong is configured to proxy to core-api.
// BASE_URL will be the Kong endpoint for DataAnalysis.
const BASE_URL = process.env.DATA_ANALYSIS_URL ?? 'http://kong:8000/data-analysis';

export interface BinMetadata {
  bin_id: string;
  cluster_id: string;
  cluster_name: string;
  zone_id: number;
  zone_name: string;
  waste_category: string;
  waste_category_colour: string;
  volume_litres: number;
}

export async function getBinMetadata(bin_id: string): Promise<BinMetadata | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/bins/${bin_id}`);
    if (!res.ok) {
      logger.warn({ bin_id, status: res.status }, 'Bin metadata not found in DataAnalysis API');
      return null;
    }
    
    const body = await res.json() as { data: any };
    const data = body.data;
    if (!data) return null;

    return {
      bin_id: data.id,
      cluster_id: data.cluster_id,
      cluster_name: data.cluster?.name ?? 'Unknown Cluster',
      zone_id: data.cluster?.zone_id ?? 0,
      zone_name: data.cluster?.zone?.name ?? 'Unknown Zone',
      waste_category: data.waste_category?.name ?? 'general',
      waste_category_colour: data.waste_category?.colour_code ?? '#808080',
      volume_litres: data.volume_litres ?? 240,
    };
  } catch (error) {
    logger.error({ bin_id, error: error instanceof Error ? error.message : String(error) }, 'Failed to fetch bin metadata from DataAnalysis API');
    return null;
  }
}

export interface ZoneMetadata {
  zone_id: number;
  zone_name: string;
  total_bins: number;
}

export async function getZoneMetadata(zone_id: number): Promise<ZoneMetadata | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/zones/${zone_id}/summary`);
    if (!res.ok) return null;
    
    const body = await res.json() as { data: any };
    const data = body.data;
    if (!data) return null;

    return {
      zone_id: data.zone?.id,
      zone_name: data.zone?.name ?? `Zone ${zone_id}`,
      total_bins: data.latest_snapshot?.total_bins ?? 0,
    };
  } catch (error) {
    logger.error({ zone_id, error: error instanceof Error ? error.message : String(error) }, 'Failed to fetch zone metadata from DataAnalysis API');
    return null;
  }
}
