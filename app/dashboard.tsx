'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import PulseDot from '@/components/ui/PulseDot';
import MapView from '@/components/views/MapView';
import BinsView from '@/components/views/BinsView';
import RoutesView from '@/components/views/RoutesView';
import AlertsView from '@/components/views/AlertsView';
import AnalyticsView from '@/components/views/AnalyticsView';
import type { Bin, Alert, Route, AnalyticsData, Zone, ViewId } from '@/lib/types';

const VIEW_TITLES: Record<ViewId, string> = {
  map:       'Live Map',
  bins:      'Bins Overview',
  route:     'Route Optimisation',
  alerts:    'Alerts & Notifications',
  analytics: 'Analytics',
};

const POLL_MS = 5000;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/v1${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
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
  const [view, setView]           = useState<ViewId>('map');
  const [bins, setBins]           = useState<Bin[]>([]);
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [routes, setRoutes]       = useState<Route[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [zones, setZones]         = useState<Zone[]>([]);
  const [connStatus, setConnStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [b, a, r, an, z] = await Promise.all([
        apiFetch<Bin[]>('/bins'),
        apiFetch<Alert[]>('/alerts'),
        apiFetch<Route[]>('/pickup-routes'),
        apiFetch<AnalyticsData>('/analytics'),
        apiFetch<Zone[]>('/zones'),
      ]);
      setBins(b);
      setAlerts(a);
      setRoutes(r);
      setAnalytics(an);
      setZones(z);
      setConnStatus('live');
    } catch {
      setConnStatus(prev => prev === 'live' ? 'error' : 'connecting');
    }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll]);

  const markRead = useCallback(async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    try { await apiFetch(`/alerts/${id}/read`, { method: 'PATCH' }); } catch { /* optimistic */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    try { await apiFetch('/alerts/read-all', { method: 'PATCH' }); } catch { /* optimistic */ }
  }, []);

  const statusLabel = connStatus === 'live'
    ? '● Live'
    : connStatus === 'error'
    ? '◌ Reconnecting…'
    : '◌ Connecting…';
  const statusColor = connStatus === 'live' ? 'var(--ok)' : 'var(--text-muted)';

  const hasData = bins.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar bins={bins} alerts={alerts}/>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar active={view} onNav={setView} alerts={alerts}/>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Breadcrumb bar */}
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
                {view === 'map'       && <div style={{ height: '100%' }}><MapView bins={bins}/></div>}
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
      height: '100%', gap: 16, color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid var(--border)', borderTopColor: status === 'error' ? 'var(--critical)' : 'var(--accent)',
        animation: status !== 'error' ? 'spin 1s linear infinite' : 'none',
      }}/>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {status === 'connecting' && 'Connecting to backend…'}
        {status === 'live'       && 'Waiting for Kafka data…'}
        {status === 'error'      && 'Cannot reach backend'}
      </div>
      <div style={{ fontSize: 12, maxWidth: 340, textAlign: 'center', lineHeight: 1.7, color: 'var(--text-muted)' }}>
        {status === 'error'
          ? 'Check that KAFKA_BROKER, KAFKA_USER, and KAFKA_PASS are set and the Fastify server is running.'
          : 'Dashboard populates as messages arrive on the Kafka topics. Start the simulator to see data flow.'}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
