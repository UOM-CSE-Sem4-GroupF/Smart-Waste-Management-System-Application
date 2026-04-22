'use client';

import { useState } from 'react';
import FillBar from '@/components/ui/FillBar';
import type { Bin, Route } from '@/lib/types';

interface Props { bins: Bin[]; routes: Route[] }

const STATUS_COLOR = { pending: 'var(--text-muted)', active: 'var(--accent)', complete: 'var(--ok)' };

function RouteCard({ route, bins }: { route: Route; bins: Bin[] }) {
  const binMap = Object.fromEntries(bins.map(b => [b.id, b]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 24px', display: 'flex', gap: 32, alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: STATUS_COLOR[route.status], border: `1px solid ${STATUS_COLOR[route.status]}`,
              borderRadius: 4, padding: '2px 8px',
            }}>
              {route.status}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{route.id}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{route.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Driver: <strong style={{ color: 'var(--text-primary)' }}>{route.driver || '—'}</strong>
            &nbsp;·&nbsp;
            Vehicle: <strong style={{ color: 'var(--text-primary)' }}>{route.vehicle || '—'}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: 'STOPS',    value: route.stops.length },
            { label: 'DISTANCE', value: `${route.distanceKm} km` },
            { label: 'DURATION', value: `${route.durationMin} min` },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
              <div style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stop list */}
      {route.stops.length > 0 && (
        <div>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            PICKUP STOPS
          </div>
          {route.stops
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((stop, i, arr) => {
              const bin = binMap[stop.binId];
              return (
                <div
                  key={stop.binId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: bin ? 1 : 0.4,
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'rgba(34,211,197,0.1)', border: '1px solid var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {stop.order}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {bin?.label ?? stop.binId}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{stop.binId}</div>
                  </div>

                  {bin && (
                    <div style={{ width: 100 }}>
                      <FillBar fill={bin.fill}/>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{bin.fill}% full</div>
                    </div>
                  )}

                  <div style={{ textAlign: 'right', minWidth: 48 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>ETA</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {stop.eta || '—'}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default function RoutesView({ bins, routes }: Props) {
  const [statusFilter, setStatusFilter] = useState<Route['status'] | 'all'>('all');

  const filtered = routes.filter(r => statusFilter === 'all' || r.status === statusFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['all', 'active', 'pending', 'complete'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${statusFilter === s ? (s === 'all' ? 'var(--accent)' : STATUS_COLOR[s as Route['status']]) : 'var(--border)'}`,
              background: statusFilter === s ? 'rgba(34,211,197,0.08)' : 'var(--bg-card)',
              color: statusFilter === s ? (s === 'all' ? 'var(--accent)' : STATUS_COLOR[s as Route['status']]) : 'var(--text-muted)',
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {filtered.length} route{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Route cards */}
      {filtered.length === 0 ? (
        <div style={{
          padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
        }}>
          No {statusFilter === 'all' ? '' : statusFilter + ' '}routes yet — waiting for{' '}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>waste.collection.jobs</span> messages.
        </div>
      ) : (
        filtered.map(route => (
          <RouteCard key={route.id} route={route} bins={bins}/>
        ))
      )}
    </div>
  );
}
