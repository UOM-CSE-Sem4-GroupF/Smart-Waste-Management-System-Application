import { EventEmitter } from 'events';

export type BinStatus   = 'ok' | 'warning' | 'critical';
export type AlertSev    = 'info' | 'warning' | 'critical';
export type WasteType   = 'general' | 'recycling' | 'organic' | 'hazardous';
export type RouteStatus = 'pending' | 'active' | 'complete';

export interface Bin {
  id: string; label: string; zone: string;
  lat: number; lng: number;
  fill: number; capacity: number; type: WasteType;
  status: BinStatus; battery: number; offline: boolean; lastPing: number;
}

export interface Alert {
  id: string; sev: AlertSev; binId: string;
  msg: string; ts: number; read: boolean;
}

export interface RouteStop { binId: string; order: number; eta: string }

export interface PickupRoute {
  id: string; label: string; driver: string; vehicle: string;
  stops: RouteStop[]; distanceKm: number; durationMin: number; status: RouteStatus;
}

export interface Zone { id: string; name: string; color: string; binCount: number; avgFill?: number }

export interface Vehicle {
  id: string;
  lat: number;
  lng: number;
  heading: number;    // 0–360 degrees
  speed: number;      // km/h
  routeId?: string;
  lastUpdate: number; // epoch ms
}

export const bins: Bin[]                 = [];
export const alerts: Alert[]             = [];
export const pickupRoutes: PickupRoute[] = [];
export const zones: Zone[]               = [];
export const vehicles: Vehicle[]         = [];

// Pub/sub so index.ts can forward mutations to Socket.IO without a circular dep
export const storeEvents = new EventEmitter();

// ── Bin mutations ────────────────────────────────────────────────────────────

export function upsertBin(patch: Partial<Bin> & { id: string }) {
  const idx = bins.findIndex(b => b.id === patch.id);
  if (idx === -1) {
    bins.push({
      id: patch.id,
      label: patch.label ?? patch.id,
      zone: patch.zone ?? 'unknown',
      lat: patch.lat ?? 0,
      lng: patch.lng ?? 0,
      fill: patch.fill ?? 0,
      capacity: patch.capacity ?? 240,
      type: patch.type ?? 'general',
      status: patch.status ?? 'ok',
      battery: patch.battery ?? 100,
      offline: patch.offline ?? false,
      lastPing: patch.lastPing ?? Date.now(),
    });
    storeEvents.emit('bin:update', bins[bins.length - 1]);
  } else {
    bins[idx] = { ...bins[idx], ...patch };
    storeEvents.emit('bin:update', bins[idx]);
  }
}

export function setBinStatus(binId: string, status: BinStatus) {
  const bin = bins.find(b => b.id === binId);
  if (bin) { bin.status = status; storeEvents.emit('bin:update', bin); }
}

// ── Alert mutations ──────────────────────────────────────────────────────────

let alertSeq = 0;
export function addAlert(sev: AlertSev, binId: string, msg: string, ts?: number) {
  alertSeq += 1;
  alerts.unshift({
    id: `ALT-${String(alertSeq).padStart(4, '0')}`,
    sev, binId, msg,
    ts: ts ?? Date.now(),
    read: false,
  });
  if (alerts.length > 200) alerts.splice(200);
}

// ── Route mutations ──────────────────────────────────────────────────────────

export function upsertRoute(patch: Partial<PickupRoute> & { id: string }) {
  const idx = pickupRoutes.findIndex(r => r.id === patch.id);
  if (idx === -1) {
    pickupRoutes.push({
      id: patch.id,
      label: patch.label ?? patch.id,
      driver: patch.driver ?? '',
      vehicle: patch.vehicle ?? '',
      stops: patch.stops ?? [],
      distanceKm: patch.distanceKm ?? 0,
      durationMin: patch.durationMin ?? 0,
      status: patch.status ?? 'pending',
    });
  } else {
    pickupRoutes[idx] = { ...pickupRoutes[idx], ...patch };
  }
}

export function setRouteStatus(routeId: string, status: RouteStatus) {
  const route = pickupRoutes.find(r => r.id === routeId);
  if (route) route.status = status;
}

// ── Vehicle mutations ────────────────────────────────────────────────────────

export function upsertVehicle(patch: Partial<Vehicle> & { id: string }) {
  const idx = vehicles.findIndex(v => v.id === patch.id);
  if (idx === -1) {
    vehicles.push({
      id: patch.id,
      lat: patch.lat ?? 0,
      lng: patch.lng ?? 0,
      heading: patch.heading ?? 0,
      speed: patch.speed ?? 0,
      routeId: patch.routeId,
      lastUpdate: patch.lastUpdate ?? Date.now(),
    });
    storeEvents.emit('vehicle:position', vehicles[vehicles.length - 1]);
  } else {
    vehicles[idx] = { ...vehicles[idx], ...patch };
    storeEvents.emit('vehicle:position', vehicles[idx]);
  }
}

// ── Zone mutations ───────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
  z1: '#22D3C5', z2: '#60A5FA', z3: '#A78BFA', z4: '#FBBF24',
};

export function upsertZone(patch: Partial<Zone> & { id: string }) {
  const idx = zones.findIndex(z => z.id === patch.id);
  if (idx === -1) {
    zones.push({
      id: patch.id,
      name: patch.name ?? patch.id,
      color: patch.color ?? ZONE_COLORS[patch.id] ?? '#94A3B8',
      binCount: patch.binCount ?? 0,
      avgFill: patch.avgFill,
    });
  } else {
    zones[idx] = { ...zones[idx], ...patch };
  }
}

// ── Analytics (derived from live state) ─────────────────────────────────────

export function getAnalytics() {
  const zoneIds = [...new Set(bins.map(b => b.zone))];
  const completed = pickupRoutes.filter(r => r.status === 'complete').length;
  return {
    weeklyCollections: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => ({
      day, count: completed,
    })),
    fillRateByZone: zoneIds.map(zId => {
      const zBins = bins.filter(b => b.zone === zId);
      return {
        zone: zId,
        avg: zBins.length
          ? Math.round(zBins.reduce((s, b) => s + b.fill, 0) / zBins.length)
          : 0,
      };
    }),
    alertsByType: (['critical', 'warning', 'info'] as const).map(type => ({
      type, count: alerts.filter(a => a.sev === type).length,
    })),
    totalCollectionsThisMonth: completed,
    avgFillOnCollection: (() => {
      const active = bins.filter(b => b.status !== 'ok');
      return active.length
        ? Math.round(active.reduce((s, b) => s + b.fill, 0) / active.length)
        : 0;
    })(),
    fuelSavedLitres: 0,
    co2SavedKg: 0,
  };
}
