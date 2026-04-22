'use client';

import FillBar from '@/components/ui/FillBar';
import type { Bin, Route } from '@/lib/types';

interface Props { bins: Bin[]; route: Route }

const STATUS_COLOR = { pending: 'var(--text-muted)', active: 'var(--accent)', complete: 'var(--ok)' };

export default function RoutesView({ bins, route }: Props) {
  const binMap = Object.fromEntries(bins.map(b => [b.id, b]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Route header card */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '20px 24px',
        display: 'flex', gap: 32, alignItems: 'flex-start',
      }}>
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
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{route.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Driver: <strong style={{ color: 'var(--text-primary)' }}>{route.driver}</strong>
            &nbsp;·&nbsp;
            Vehicle: <strong style={{ color: 'var(--text-primary)' }}>{route.vehicle}</strong>
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
              <div style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stop list */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
          PICKUP STOPS
        </div>
        {route.stops.map((stop, i) => {
          const bin = binMap[stop.binId];
          if (!bin) return null;
          return (
            <div
              key={stop.binId}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                borderBottom: i < route.stops.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              {/* Order badge */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(34,211,197,0.1)', border: '1px solid var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)', fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {stop.order}
              </div>

              {/* Connector line */}
              {i < route.stops.length - 1 && (
                <div style={{
                  position: 'absolute', left: 34,
                  width: 1, height: 28, background: 'var(--border)',
                  marginTop: 28,
                }}/>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{bin.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{bin.id}</div>
              </div>

              {/* Fill bar */}
              <div style={{ width: 100 }}>
                <FillBar fill={bin.fill}/>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{bin.fill}% full</div>
              </div>

              {/* ETA */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>ETA</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono', monospace" }}>{stop.eta}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placeholder notice */}
      <div style={{
        background: 'rgba(34,211,197,0.04)', border: '1px dashed rgba(34,211,197,0.2)',
        borderRadius: 10, padding: '16px 20px',
        color: 'var(--text-muted)', fontSize: 12, textAlign: 'center',
      }}>
        Route optimisation engine and turn-by-turn map will be connected when the backend is ready.
      </div>
    </div>
  );
}