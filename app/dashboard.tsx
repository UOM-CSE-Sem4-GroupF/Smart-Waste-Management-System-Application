'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import PulseDot from '@/components/ui/PulseDot';
import MapView from '@/components/views/MapView';
import BinsView from '@/components/views/BinsView';
import RoutesView from '@/components/views/RoutesView';
import AlertsView from '@/components/views/AlertsView';
import AnalyticsView from '@/components/views/AnalyticsView';
import { BINS, ALERTS, ROUTE, ANALYTICS, ZONES } from '@/lib/mock-data';
import type { Bin, Alert, Route, AnalyticsData, Zone, ViewId } from '@/lib/types';

const VIEW_TITLES: Record<ViewId, string> = {
  map:       'Live Map',
  bins:      'Bins Overview',
  route:     'Route Optimisation',
  alerts:    'Alerts & Notifications',
  analytics: 'Analytics',
};

const POLL_MS = 8000;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/v1${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export default function Dashboard() {
  const [view, setView]           = useState<ViewId>('map');
  const [bins, setBins]           = useState<Bin[]>(BINS);
  const [alerts, setAlerts]       = useState<Alert[]>(ALERTS.map(a => ({ ...a, read: false })));
  const [route, setRoute]         = useState<Route>(ROUTE);
  const [analytics, setAnalytics] = useState<AnalyticsData>(ANALYTICS);
  const [zones, setZones]         = useState<Zone[]>(ZONES);
  const [apiReady, setApiReady]   = useState(false);

  // Bootstrap from API on mount
  useEffect(() => {
    async function load() {
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
        if (r[0]) setRoute(r[0]);
        setAnalytics(an);
        setZones(z);
        setApiReady(true);
      } catch {
        console.warn('API unavailable — running on mock data');
      }
    }
    load();
  }, []);

  // Poll bins when API is live
  useEffect(() => {
    if (!apiReady) return;
    const id = setInterval(async () => {
      try { setBins(await apiFetch<Bin[]>('/bins')); } catch { /* keep last state */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [apiReady]);

  // Local simulation when API is offline
  useEffect(() => {
    if (apiReady) return;
    const id = setInterval(() => {
      setBins(prev => prev.map(b => {
        if (b.offline) return b;
        const fill = Math.max(0, Math.min(100, Math.round(b.fill + (Math.random() - 0.35) * 3)));
        return { ...b, fill, status: fill >= 85 ? 'critical' : fill >= 60 ? 'warning' : 'ok', lastPing: Date.now() };
      }));
    }, 4000);
    return () => clearInterval(id);
  }, [apiReady]);

  const markRead = useCallback(async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    try { await apiFetch(`/alerts/${id}`, { method: 'PATCH' }); } catch { /* optimistic */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    try { await apiFetch('/alerts', { method: 'PATCH' }); } catch { /* optimistic */ }
  }, []);

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
              {view === 'map' && <><PulseDot color="var(--ok)"/><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Live feed</span></>}
              <span style={{ fontSize: 10, color: apiReady ? 'var(--ok)' : 'var(--text-muted)' }}>
                {apiReady ? '● API' : '◌ Mock data'}
              </span>
            </span>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {view === 'map'       && <div style={{ height: '100%' }}><MapView bins={bins}/></div>}
            {view === 'bins'      && <BinsView bins={bins}/>}
            {view === 'route'     && <RoutesView bins={bins} route={route}/>}
            {view === 'alerts'    && <AlertsView alerts={alerts} onMarkRead={markRead} onMarkAllRead={markAllRead}/>}
            {view === 'analytics' && <AnalyticsView analytics={analytics} zones={zones}/>}
          </div>
        </div>
      </div>
    </div>
  );
}