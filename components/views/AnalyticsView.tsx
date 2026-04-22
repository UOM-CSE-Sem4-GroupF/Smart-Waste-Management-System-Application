'use client';

import type { AnalyticsData, Zone } from '@/lib/types';

interface Props { analytics: AnalyticsData; zones: Zone[] }

function StatCard({ label, value, unit, color }: { label: string; value: number | string; unit?: string; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ color, fontSize: 26, fontWeight: 700 }}>{value}</span>
        {unit && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{unit}</span>}
      </div>
    </div>
  );
}

function BarChart({ data, color, maxVal }: { data: { label: string; value: number }[]; color: string; maxVal?: number }) {
  const max = maxVal ?? Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
      {data.map(({ label, value }) => (
        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{value}</span>
          <div style={{
            width: '100%', background: color, borderRadius: '3px 3px 0 0',
            height: `${(value / max) * 80}px`, minHeight: 4,
            transition: 'height 0.4s ease',
            opacity: 0.85,
          }}/>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function HorizBar({ label, value, color, max = 100 }: { label: string; value: number; color: string; max?: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }}/>
      </div>
    </div>
  );
}

export default function AnalyticsView({ analytics, zones }: Props) {
  const { weeklyCollections, fillRateByZone, alertsByType, totalCollectionsThisMonth, avgFillOnCollection, fuelSavedLitres, co2SavedKg } = analytics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="COLLECTIONS THIS MONTH" value={totalCollectionsThisMonth} color="var(--accent)"/>
        <StatCard label="AVG FILL ON COLLECTION"  value={avgFillOnCollection}      unit="%" color="var(--ok)"/>
        <StatCard label="FUEL SAVED"               value={fuelSavedLitres}          unit="L" color="var(--info)"/>
        <StatCard label="CO₂ SAVED"                value={co2SavedKg}               unit="kg" color="var(--warning)"/>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Weekly bar chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 16 }}>
            WEEKLY COLLECTIONS
          </div>
          <BarChart
            data={weeklyCollections.map(w => ({ label: w.day, value: w.count }))}
            color="var(--accent)"
          />
        </div>

        {/* Alert breakdown */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 16 }}>
            ALERTS THIS MONTH
          </div>
          <BarChart
            data={alertsByType.map(a => ({ label: a.type, value: a.count }))}
            color="var(--warning)"
          />
        </div>
      </div>

      {/* Fill rate by zone */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 16 }}>
          AVERAGE FILL RATE BY ZONE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px' }}>
          {fillRateByZone.map((z, i) => {
            const zone = zones[i];
            return (
              <HorizBar
                key={z.zone}
                label={z.zone}
                value={z.avg}
                color={zone?.color ?? 'var(--accent)'}
              />
            );
          })}
        </div>
      </div>

      {/* Zone summary table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
          ZONES
        </div>
        {zones.map((zone, i) => (
          <div key={zone.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
            borderBottom: i < zones.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: zone.color, flexShrink: 0 }}/>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{zone.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{zone.binCount} bins</span>
          </div>
        ))}
      </div>
    </div>
  );
}