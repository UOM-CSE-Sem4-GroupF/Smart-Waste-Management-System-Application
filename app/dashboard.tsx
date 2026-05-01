'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import { BINS, ALERTS, ROUTE, ANALYTICS, ZONES, VEHICLES } from '@/mock';
import type { Bin, Alert, Route, AnalyticsData, Zone, Vehicle, ViewId } from '@/lib/types';

export default function Dashboard() {
  const [view, setView] = useState<ViewId>('map');
  const router = useRouter();
  const [bins] = useState<Bin[]>(BINS);
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS);
  const [routes] = useState<Route[]>([ROUTE]);
  const [analytics] = useState<AnalyticsData>(ANALYTICS);
  const [zones] = useState<Zone[]>(ZONES);
  const [vehicles] = useState<Vehicle[]>(VEHICLES);

  const handleNav = (selected: ViewId) => {
    setView(selected);
    router.push(`/${selected}`);
  };

  const criticalBins = bins.filter(b => b.status === 'critical').length;
  const warningBins = bins.filter(b => b.status === 'warning').length;
  const offlineBins = bins.filter(b => b.offline).length;
  const unreadAlerts = alerts.filter(a => !a.read).length;
  const activeRoutes = routes.filter(r => r.status === 'active' || r.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>
      <TopBar bins={bins} alerts={alerts}/>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar active={view} onNav={handleNav} alerts={alerts}/>

        <main style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--bg-app)' }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Operations Command Center
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 640, lineHeight: 1.7 }}>
                  Monitor bin fill levels, route status, and critical alerts in a polished command view.
                  This UI is built entirely from mock data so it stays fast and backend-free.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleNav('map')}
                  style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid transparent', background: 'var(--accent)', color: '#0F1624', fontWeight: 700, cursor: 'pointer' }}
                >
                  Open Map View
                </button>
                <button
                  onClick={() => handleNav('jobs')}
                  style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  View Jobs
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {[
                { label: 'Active bins', value: bins.length, accent: 'var(--accent)' },
                { label: 'Critical bins', value: criticalBins, accent: 'var(--critical)' },
                { label: 'Urgent bins', value: warningBins, accent: 'var(--warning)' },
                { label: 'Offline bins', value: offlineBins, accent: '#64748B' },
                { label: 'Active routes', value: activeRoutes, accent: 'var(--ok)' },
                { label: 'Unread alerts', value: unreadAlerts, accent: 'var(--warning)' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {stat.label}
                  </span>
                  <span style={{ fontSize: 32, fontWeight: 700, color: stat.accent }}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Operational Snapshot</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Mock state</span>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 16, background: 'rgba(56,189,248,0.06)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg fill across bins</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{Math.round(bins.reduce((sum, b) => sum + b.fill, 0) / bins.length)}%</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Data driven from current mock dataset</div>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {alerts.slice(0, 3).map(alert => (
                    <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, background: 'var(--bg-surface)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{alert.msg}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Bin {alert.binId} • {alert.sev.toUpperCase()}</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: alert.sev === 'critical' ? 'var(--critical)' : alert.sev === 'warning' ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {alert.sev}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Quick Actions</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {([
                    { title: 'View live map', subtitle: 'Inspect bin clusters and route positions', action: 'map' },
                    { title: 'Manage jobs', subtitle: 'Track collection progress and completed routes', action: 'jobs' },
                    { title: 'Review analytics', subtitle: 'Assess performance trends and zone fill rates', action: 'analytics' },
                    { title: 'Search history', subtitle: 'Filter completed jobs and export past runs', action: 'history' },
                  ] as const).map(item => (
                    <button
                      key={item.title}
                      onClick={() => handleNav(item.action)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '16px',
                        borderRadius: 16,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-surface)',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Design Intent</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  This dashboard is intentionally designed for fast visual scanning, clear section hierarchy, and lightweight navigation. All data shown is mock-only, so you can focus on the UI/UX experience.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
