'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io as socketIo } from 'socket.io-client';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import PulseDot from '@/components/ui/PulseDot';
import MapView from '@/components/views/MapView';
import BinsView from '@/components/views/BinsView';
import RoutesView from '@/components/views/RoutesView';
import AlertsView from '@/components/views/AlertsView';
import AnalyticsView from '@/components/views/AnalyticsView';
import type { Bin, Alert, Route, AnalyticsData, Zone, Vehicle, ViewId, BinStatus, WasteType } from '@/lib/types';

const VIEW_TITLES: Record<ViewId, string> = {
  map:       'Live Map',
  bins:      'Bins Overview',
  route:     'Route Optimisation',
  alerts:    'Alerts & Notifications',
  analytics: 'Analytics',
};

const POLL_MS  = 10000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

// ── F3 → legacy shape adapters ───────────────────────────────────────────────

type F3BinState = {
  bin_id: string; fill_level_pct: number; urgency_status: string;
  waste_category: string; volume_litres: number; zone_id: string;
  lat: number; lng: number; battery_pct: number; last_reading_at: string;
};
type F3Vehicle = {
  vehicle_id: string; lat: number; lng: number; heading: number;
  speed_kmh: number; current_job_id?: string; last_update: string;
};
type F3Zone = {
  zone_id: string; bin_count: number; avg_fill_pct: number;
};
type F3Job = {
  job_id: string; state: string; zone_id: string; waste_category: string;
  bin_ids: string[]; driver_id?: string; vehicle_id?: string;
};

const ZONE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];
const WASTE_TYPE_MAP: Record<string, string> = {
  general: 'general', food_waste: 'organic', paper: 'recycling',
  glass: 'recycling', plastic: 'recycling', e_waste: 'hazardous',
};

function adaptBins(raw: { data?: F3BinState[] } | F3BinState[]): Bin[] {
  const items = Array.isArray(raw) ? raw : (raw.data ?? []);
  return items.map(b => ({
    id:       b.bin_id,
    label:    b.bin_id,
    zone:     b.zone_id,
    lat:      b.lat,
    lng:      b.lng,
    fill:     b.fill_level_pct,
    capacity: b.volume_litres,
    type:     (WASTE_TYPE_MAP[b.waste_category] ?? 'general') as WasteType,
    status:   (b.urgency_status === 'critical' ? 'critical' : b.urgency_status === 'normal' ? 'ok' : 'warning') as BinStatus,
    battery:  b.battery_pct ?? 100,
    offline:  false,
    lastPing: Date.parse(b.last_reading_at),
  }));
}

function adaptZones(raw: { data?: F3Zone[] } | F3Zone[]): Zone[] {
  const items = Array.isArray(raw) ? raw : (raw.data ?? []);
  return items.map((z, i) => ({
    id:       z.zone_id,
    name:     z.zone_id,
    color:    ZONE_COLORS[i % ZONE_COLORS.length],
    binCount: z.bin_count,
    avgFill:  z.avg_fill_pct,
  }));
}

function adaptVehicles(raw: { data?: F3Vehicle[] } | F3Vehicle[]): Vehicle[] {
  const items = Array.isArray(raw) ? raw : (raw.data ?? []);
  return items.map(v => ({
    id:         v.vehicle_id,
    lat:        v.lat,
    lng:        v.lng,
    heading:    v.heading,
    speed:      v.speed_kmh,
    routeId:    v.current_job_id,
    lastUpdate: Date.parse(v.last_update),
  }));
}

function adaptRoutes(raw: { data?: F3Job[] } | F3Job[]): Route[] {
  const items = Array.isArray(raw) ? raw : (raw.data ?? []);
  return items.map(j => ({
    id:          j.job_id,
    label:       `${j.waste_category} – ${j.zone_id}`,
    driver:      j.driver_id ?? '—',
    vehicle:     j.vehicle_id ?? '—',
    stops:       j.bin_ids.map((binId, order) => ({ binId, order, eta: '—' })),
    distanceKm:  0,
    durationMin: 0,
    status:      (['COMPLETED','CLOSED'].includes(j.state) ? 'complete'
                 : ['COLLECTING','IN_TRANSIT','ARRIVED','DRIVER_ACCEPTED'].includes(j.state) ? 'active'
                 : 'pending') as Route['status'],
  }));
}

const EMPTY_ANALYTICS: AnalyticsData = {
  weeklyCollections: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => ({ day, count: 0 })),
  fillRateByZone: [],
  alertsByType: [
    { type: 'critical', count: 0 },
    { type: 'warning',  count: 0 },
    { type: 'info',     count: 0 },
  ],
  totalCollectionsThisMonth: 0,
  avgFillOnCollection: 0,
  fuelSavedLitres: 0,
  co2SavedKg: 0,
};

export default function Dashboard() {
  const [view, setView]             = useState<ViewId>('map');
  const [bins, setBins]             = useState<Bin[]>([]);
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [routes, setRoutes]         = useState<Route[]>([]);
  const [analytics]                  = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [zones, setZones]           = useState<Zone[]>([]);
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [connStatus, setConnStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const [binsRes, jobsRes, zonesRes, vehiclesRes] = await Promise.allSettled([
      apiFetch<unknown>('/bins'),
      apiFetch<unknown>('/collection-jobs'),
      apiFetch<unknown>('/zones'),
      apiFetch<unknown>('/vehicles/active'),
    ]);

    let anyOk = false;

    if (binsRes.status === 'fulfilled') {
      setBins(adaptBins(binsRes.value as Parameters<typeof adaptBins>[0]));
      anyOk = true;
    }
    if (jobsRes.status === 'fulfilled') {
      setRoutes(adaptRoutes(jobsRes.value as Parameters<typeof adaptRoutes>[0]));
      anyOk = true;
    }
    if (zonesRes.status === 'fulfilled') {
      setZones(adaptZones(zonesRes.value as Parameters<typeof adaptZones>[0]));
      anyOk = true;
    }
    if (vehiclesRes.status === 'fulfilled') {
      setVehicles(adaptVehicles(vehiclesRes.value as Parameters<typeof adaptVehicles>[0]));
      anyOk = true;
    }

    if (anyOk) setConnStatus('live');
    else setConnStatus(prev => prev === 'live' ? 'error' : 'connecting');
  }, []);

  // Polling (slower — Socket.IO handles real-time)
  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll]);

  // Socket.IO — real-time bin and vehicle updates
  useEffect(() => {
    const socket = socketIo(API_BASE, { path: '/socket.io', transports: ['websocket'] });

    // Join dashboard room so server emits reach this client
    socket.on('connect', () => socket.emit('join', ['dashboard-all']));

    socket.on('bin:update', (raw: Record<string, unknown>) => {
      const bin_id = String(raw.bin_id ?? '');
      if (!bin_id) return;
      const fill         = Number(raw.fill_level_pct ?? 0);
      const urgency      = String(raw.urgency_status ?? 'normal');
      const status       = (urgency === 'critical' ? 'critical' : urgency === 'normal' ? 'ok' : 'warning') as BinStatus;
      const lastPing     = Date.parse(String(raw.timestamp ?? new Date().toISOString()));
      const battery      = raw.battery_pct !== undefined ? Number(raw.battery_pct) : undefined;
      // Only patch mutable fields; preserve lat/lng loaded from REST (telemetry has no location)
      setBins(prev => prev.map(b => b.id === bin_id ? {
        ...b, fill, status, lastPing,
        ...(battery !== undefined ? { battery } : {}),
      } : b));
    });

    socket.on('vehicle:position', (vehicle: Vehicle) => {
      setVehicles(prev => {
        const idx = prev.findIndex(v => v.id === vehicle.id);
        return idx === -1 ? [...prev, vehicle] : prev.map((v, i) => i === idx ? vehicle : v);
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  const markRead = useCallback(async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    try { await apiFetch(`/alerts/${id}/read`, { method: 'PATCH' }); } catch { /* optimistic */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    try { await apiFetch('/alerts/read-all', { method: 'PATCH' }); } catch { /* optimistic */ }
  }, []);

  const statusLabel = connStatus === 'live' ? '● Live'
    : connStatus === 'error' ? '◌ Reconnecting…' : '◌ Connecting…';
  const statusColor = connStatus === 'live' ? 'var(--ok)' : 'var(--text-muted)';
  const hasData = bins.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar bins={bins} alerts={alerts}/>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar active={view} onNav={setView} alerts={alerts}/>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            height: 40, display: 'flex', alignItems: 'center', padding: '0 20px',
            borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0,
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Dashboard</span>
            <span style={{ color: 'var(--border-hi)', margin: '0 8px' }}>›</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 11, fontWeight: 600 }}>{VIEW_TITLES[view]}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {view === 'map' && hasData && (
                <><PulseDot color="var(--ok)"/><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Live feed</span></>
              )}
              <span style={{ fontSize: 10, color: statusColor }}>{statusLabel}</span>
            </span>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {!hasData ? (
              <EmptyKafkaState status={connStatus}/>
            ) : (
              <>
                {view === 'map'       && <div style={{ height: '100%' }}><MapView bins={bins} vehicles={vehicles} routes={routes} zones={zones}/></div>}
                {view === 'bins'      && <BinsView bins={bins}/>}
                {view === 'route'     && <RoutesView bins={bins} routes={routes}/>}
                {view === 'alerts'    && <AlertsView alerts={alerts} onMarkRead={markRead} onMarkAllRead={markAllRead}/>}
                {view === 'analytics' && <AnalyticsView analytics={analytics} zones={zones}/>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyKafkaState({ status }: { status: 'connecting' | 'live' | 'error' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid var(--border)',
        borderTopColor: status === 'error' ? 'var(--critical)' : 'var(--accent)',
        animation: status !== 'error' ? 'spin 1s linear infinite' : 'none',
      }}/>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {status === 'connecting' && 'Connecting to backend…'}
        {status === 'live'       && 'Waiting for Kafka data…'}
        {status === 'error'      && 'Cannot reach backend'}
      </div>
      <div style={{ fontSize: 12, maxWidth: 340, textAlign: 'center', lineHeight: 1.7, color: 'var(--text-muted)' }}>
        {status === 'error'
          ? 'Check that the Fastify server is running on port 3001.'
          : 'Dashboard populates as messages arrive on the Kafka topics.'}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
