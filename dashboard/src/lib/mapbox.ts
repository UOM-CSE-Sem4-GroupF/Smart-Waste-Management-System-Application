export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
export const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? 'mapbox://styles/mapbox/light-v11'

export const STATUS_COLOURS: Record<string, string> = {
  normal:   '#22c55e',
  monitor:  '#eab308',
  urgent:   '#f97316',
  critical: '#ef4444',
  offline:  '#6b7280',
}

export const VEHICLE_ROUTE_COLOURS: Record<string, string> = {
  'LORRY-01': '#3b82f6', // blue
  'LORRY-02': '#8b5cf6', // purple
  'LORRY-03': '#ec4899', // pink
  'LORRY-04': '#f97316', // orange
}

/** Default colour for vehicles not in the map above */
export const DEFAULT_ROUTE_COLOUR = '#64748b'
