'use client';

import { useState } from 'react';
import type { Alert, AlertSeverity } from '@/lib/types';

interface Props { alerts: Alert[]; onMarkRead: (id: string) => void; onMarkAllRead: () => void }

const SEV_COLOR: Record<AlertSeverity, string> = {
  critical: 'var(--critical)',
  warning:  'var(--warning)',
  info:     'var(--info)',
};

const SEV_BG: Record<AlertSeverity, string> = {
  critical: 'rgba(248,113,113,0.08)',
  warning:  'rgba(251,191,36,0.08)',
  info:     'rgba(96,165,250,0.08)',
};

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function AlertsView({ alerts, onMarkRead, onMarkAllRead }: Props) {
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');
  const unread = alerts.filter(a => !a.read).length;

  const filtered = alerts.filter(a => filter === 'all' || a.sev === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'critical', 'warning', 'info'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${filter === s ? (s === 'all' ? 'var(--accent)' : SEV_COLOR[s as AlertSeverity]) : 'var(--border)'}`,
                background: filter === s ? (s === 'all' ? 'rgba(34,211,197,0.1)' : `${SEV_BG[s as AlertSeverity]}`) : 'var(--bg-card)',
                color: filter === s ? (s === 'all' ? 'var(--accent)' : SEV_COLOR[s as AlertSeverity]) : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        {unread > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-muted)',
            }}
          >
            Mark all read ({unread})
          </button>
        )}
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(alert => (
          <div
            key={alert.id}
            style={{
              background: alert.read ? 'var(--bg-card)' : SEV_BG[alert.sev],
              border: `1px solid ${alert.read ? 'var(--border)' : SEV_COLOR[alert.sev]}`,
              borderRadius: 10, padding: '14px 18px',
              display: 'flex', alignItems: 'flex-start', gap: 14,
              opacity: alert.read ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Severity indicator */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: SEV_COLOR[alert.sev],
              marginTop: 4, flexShrink: 0,
              boxShadow: alert.read ? 'none' : `0 0 6px ${SEV_COLOR[alert.sev]}`,
            }}/>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: SEV_COLOR[alert.sev], letterSpacing: '0.08em' }}>
                  {alert.sev}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {alert.binId} · {alert.id}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{alert.msg}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{relativeTime(alert.ts)}</span>
              {!alert.read && (
                <button
                  onClick={() => onMarkRead(alert.id)}
                  style={{
                    fontSize: 10, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--bg-input)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No alerts in this category.
          </div>
        )}
      </div>
    </div>
  );
}