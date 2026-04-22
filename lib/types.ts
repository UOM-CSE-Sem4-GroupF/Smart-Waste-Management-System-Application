export type BinStatus = 'ok' | 'warning' | 'critical';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type WasteType = 'general' | 'recycling' | 'organic' | 'hazardous';
export type ViewId = 'map' | 'bins' | 'route' | 'alerts' | 'analytics';

export interface Bin {
  id: string;
  label: string;
  zone: string;
  lat: number;
  lng: number;
  fill: number;       // 0–100
  capacity: number;   // litres
  type: WasteType;
  status: BinStatus;
  battery: number;    // 0–100
  offline: boolean;
  lastPing: number;   // epoch ms
}

export interface Alert {
  id: string;
  sev: AlertSeverity;
  binId: string;
  msg: string;
  ts: number;
  read: boolean;
}

export interface RouteStop {
  binId: string;
  order: number;
  eta: string;
}

export interface Route {
  id: string;
  label: string;
  driver: string;
  vehicle: string;
  stops: RouteStop[];
  distanceKm: number;
  durationMin: number;
  status: 'pending' | 'active' | 'complete';
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  binCount: number;
}

export interface AnalyticsData {
  weeklyCollections: { day: string; count: number }[];
  fillRateByZone: { zone: string; avg: number }[];
  alertsByType: { type: AlertSeverity; count: number }[];
  totalCollectionsThisMonth: number;
  avgFillOnCollection: number;
  fuelSavedLitres: number;
  co2SavedKg: number;
}