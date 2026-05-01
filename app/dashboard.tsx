import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import PulseDot from '@/components/ui/PulseDot';
import MapView from '@/components/views/MapView';
import RoutesView from '@/components/views/RoutesView';
import AlertsView from '@/components/views/AlertsView';
import AnalyticsView from '@/components/views/AnalyticsView';
import { BINS, ALERTS, ROUTE, ANALYTICS, ZONES } from '@/lib/mock-data';
import type { Bin, Alert, Route, AnalyticsData, Zone, Vehicle, ViewId } from '@/lib/types';

const VIEW_TITLES: Record<ViewId, string> = {
  map:       'Map',
  jobs:      'Jobs',
  analytics: 'Analytics',
  history:   'History',
};

export default function Dashboard() {
  const [view, setView]             = useState<ViewId>('map');
  const router = useRouter();

  useEffect(() => {
    if (view === 'map') {
      router.push('/map');
    } else if (view === 'jobs') {
      router.push('/jobs');
    } else if (view === 'analytics') {
      router.push('/analytics');
    } else if (view === 'history') {
      router.push('/history');
    }
  }, [view, router]);
  const [bins]                      = useState<Bin[]>(BINS);
  const [alerts, setAlerts]         = useState<Alert[]>(ALERTS);
  const [routes]                    = useState<Route[]>([ROUTE]);
  const [analytics]                 = useState<AnalyticsData>(ANALYTICS);
  const [zones]                     = useState<Zone[]>(ZONES);
  const [vehicles]                  = useState<Vehicle[]>([]);

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

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
            </span>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏠</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                Smart Waste Management
              </div>
              <div style={{ fontSize: '16px', maxWidth: '400px' }}>
                Use the sidebar to navigate to different sections of the dashboard.
              </div>
            </div>
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
