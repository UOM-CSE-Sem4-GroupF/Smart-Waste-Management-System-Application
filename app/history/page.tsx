'use client';

import { useState } from 'react';
import { ALERTS, BINS } from '@/lib/mock-data';
import type { Alert, AlertSeverity } from '@/lib/types';

const SEV_COLORS: Record<AlertSeverity, string> = {
  critical: 'var(--critical)',
  warning: 'var(--warning)',
  info: 'var(--info)',
};

const SEV_BG: Record<AlertSeverity, string> = {
  critical: 'rgba(239, 68, 68, 0.1)',
  warning: 'rgba(245, 158, 11, 0.1)',
  info: 'rgba(107, 114, 128, 0.1)',
};

function AlertCard({ alert, onMarkRead }: { alert: Alert; onMarkRead: (id: string) => void }) {
  const bin = BINS.find(b => b.id === alert.binId);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
      marginBottom: 16,
      opacity: alert.read ? 0.7 : 1,
      borderLeft: `4px solid ${SEV_COLORS[alert.sev]}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: SEV_COLORS[alert.sev],
            flexShrink: 0,
          }}/>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              {bin?.label || alert.binId}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {bin?.zone} • {bin?.type}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: SEV_COLORS[alert.sev],
            border: `1px solid ${SEV_COLORS[alert.sev]}`,
            borderRadius: 4,
            padding: '2px 8px',
          }}>
            {alert.sev}
          </span>
          {!alert.read && (
            <button
              onClick={() => onMarkRead(alert.id)}
              style={{
                fontSize: 12,
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Mark as read
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>
        {alert.msg}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {new Date(alert.ts).toLocaleString()}
        </div>
        {alert.read && (
          <div style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600 }}>
            ✓ Read
          </div>
        )}
      </div>
    </div>
  );
}

function AlertStats({ alerts }: { alerts: Alert[] }) {
  const total = alerts.length;
  const unread = alerts.filter(a => !a.read).length;
  const critical = alerts.filter(a => a.sev === 'critical').length;
  const warning = alerts.filter(a => a.sev === 'warning').length;
  const info = alerts.filter(a => a.sev === 'info').length;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: 16,
      marginBottom: 24,
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{total}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Alerts</div>
      </div>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--critical)' }}>{unread}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unread</div>
      </div>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--critical)' }}>{critical}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Critical</div>
      </div>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{warning}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Warning</div>
      </div>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--info)' }}>{info}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Info</div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [alerts, setAlerts] = useState(ALERTS);
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');
  const [showRead, setShowRead] = useState(true);

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const filteredAlerts = alerts
    .filter(a => filter === 'all' || a.sev === filter)
    .filter(a => showRead || !a.read)
    .sort((a, b) => b.ts - a.ts); // Most recent first

  return (
    <div style={{ padding: '20px', background: 'var(--bg-app)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Alert History
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
            Monitor and manage waste management system alerts and notifications
          </p>
        </div>

        {/* Stats */}
        <AlertStats alerts={alerts} />

        {/* Controls */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Filter by severity:</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['all', 'critical', 'warning', 'info'] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setFilter(sev)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: `1px solid ${filter === sev ? 'var(--accent)' : 'var(--border)'}`,
                      background: filter === sev ? 'rgba(34, 211, 197, 0.1)' : 'var(--bg-surface)',
                      color: filter === sev ? 'var(--accent)' : 'var(--text-muted)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showRead}
                  onChange={(e) => setShowRead(e.target.checked)}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Show read alerts</span>
              </label>

              <button
                onClick={markAllRead}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--accent)',
                  background: 'var(--accent)',
                  color: 'white',
                }}
              >
                Mark All Read
              </button>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              Alerts ({filteredAlerts.length})
            </h2>
          </div>

          {filteredAlerts.length > 0 ? (
            <div>
              {filteredAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} onMarkRead={markRead} />
              ))}
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                No alerts found
              </div>
              <div style={{ fontSize: '14px' }}>
                Try adjusting your filters or check back later for new alerts.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}