'use client';

import { useState } from 'react';
import type { Alert, AlertType } from '@/lib/types';

interface Props {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  onAcknowledgeAll: () => void;
}

const TYPE_CONFIG: Record<AlertType, { color: string; bg: string; label: string; icon: string }> = {
  urgent:    { color: '#F97316', bg: 'rgba(249,115,22,0.08)',  label: 'Urgent Bin',       icon: '🗑' },
  deviation: { color: '#EAB308', bg: 'rgba(234,179,8,0.08)',   label: 'Route Deviation',  icon: '🚛' },
  escalated: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   label: 'Escalated',        icon: '⚠' },
};

function relativeTime(ts: string) {
  const diff = Date.now() - Date.parse(ts);
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function AlertsView({ alerts, onAcknowledge, onAcknowledgeAll }: Props) {
  const [filter, setFilter] = useState<AlertType | 'all'>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const unacknowledged = alerts.filter(a => !a.acknowledged).length;

  const filtered = alerts.filter(a => {
    if (!showAcknowledged && a.acknowledged) return false;
    if (filter !== 'all' && a.type !== filter) return false;
    return true;
  });

  const countByType = (type: AlertType) => alerts.filter(a => !a.acknowledged && a.type === type).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {(['urgent', 'deviation', 'escalated'] as AlertType[]).map(type => {
          const cfg = TYPE_CONFIG[type];
          const count = countByType(type);
          return (
            <div key={type} style={{
              background: count > 0 ? cfg.bg : 'var(--bg-card)',
              border: `1px solid ${count > 0 ? cfg.color : 'var(--border)'}`,
              borderRadius: 10, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }} onClick={() => setFilter(filter === type ? 'all' : type)}>
              <span style={{ fontSize: 20 }}>{cfg.icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: cfg.color }}>
                  {cfg.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: count > 0 ? cfg.color : 'var(--text-muted)' }}>
                  {count}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'urgent', 'deviation', 'escalated'] as const).map(s => {
            const cfg = s !== 'all' ? TYPE_CONFIG[s] : null;
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${isActive ? (cfg?.color ?? 'var(--accent)') : 'var(--border)'}`,
                  background: isActive ? (cfg ? cfg.bg : 'rgba(34,211,197,0.1)') : 'var(--bg-card)',
                  color: isActive ? (cfg?.color ?? 'var(--accent)') : 'var(--text-muted)',
                  textTransform: 'capitalize',
                }}
              >
                {s === 'all' ? 'All' : TYPE_CONFIG[s].label}
              </button>
            );
          })}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={e => setShowAcknowledged(e.target.checked)}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          Show dismissed
        </label>

        <div style={{ flex: 1 }}/>
        {unacknowledged > 0 && (
          <button
            onClick={onAcknowledgeAll}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-muted)',
            }}
          >
            Dismiss all ({unacknowledged})
          </button>
        )}
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(alert => {
          const cfg = TYPE_CONFIG[alert.type];
          return (
            <div
              key={alert.id}
              style={{
                background: alert.acknowledged ? 'var(--bg-card)' : cfg.bg,
                border: `1px solid ${alert.acknowledged ? 'var(--border)' : cfg.color}`,
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
                opacity: alert.acknowledged ? 0.55 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {/* Type indicator */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: cfg.color,
                marginTop: 5, flexShrink: 0,
                boxShadow: alert.acknowledged ? 'none' : `0 0 8px ${cfg.color}`,
              }}/>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: cfg.color, letterSpacing: '0.08em',
                    border: `1px solid ${cfg.color}`, borderRadius: 4, padding: '1px 6px',
                  }}>
                    {cfg.label}
                  </span>
                  {alert.bin_id && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {alert.bin_id}
                    </span>
                  )}
                  {alert.vehicle_id && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {alert.vehicle_id}
                    </span>
                  )}
                  {alert.job_id && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                      Job {alert.job_id}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {alert.message}
                </div>
                {alert.zone_id !== undefined && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Zone {alert.zone_id}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {relativeTime(alert.received_at)}
                </span>
                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
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
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {filter === 'all'
              ? 'No alerts — system is operating normally.'
              : `No ${TYPE_CONFIG[filter as AlertType].label.toLowerCase()} alerts.`}
          </div>
        )}
      </div>
    </div>
  );
}
