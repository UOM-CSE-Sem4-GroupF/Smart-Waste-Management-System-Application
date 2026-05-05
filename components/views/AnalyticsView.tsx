'use client';

import { useState } from 'react';
import type { AnalyticsData, Zone, Bin, Job } from '@/lib/types';
import { CATEGORY_COLOURS, JOB_STATE_COLOURS, ACTIVE_JOB_STATES } from '@/lib/types';

interface Props {
  analytics: AnalyticsData;
  zones: Zone[];
  bins: Bin[];
  jobs: Job[];
}

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

function VerticalBarChart({ data, getColor }: {
  data: { label: string; value: number; color?: string }[];
  getColor?: (label: string, value: number) => string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 110 }}>
      {data.map(({ label, value, color }) => {
        const c = color ?? getColor?.(label, value) ?? 'var(--accent)';
        return (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{value}</span>
            <div style={{
              width: '100%', background: c, borderRadius: '3px 3px 0 0',
              height: `${(value / max) * 80}px`, minHeight: 3,
              transition: 'height 0.4s ease', opacity: 0.85,
            }}/>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function HorizBar({ label, value, color, max = 100 }: { label: string; value: number; color: string; max?: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }}/>
      </div>
    </div>
  );
}

function ChartCard({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
          {title}
        </span>
        {badge && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsView({ analytics, zones, bins, jobs }: Props) {
  const [selectedZone, setSelectedZone] = useState<string>('all');

  const { weeklyCollections, fillRateByZone, alertsByType, totalCollectionsThisMonth, avgFillOnCollection, fuelSavedLitres, co2SavedKg } = analytics;
  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]));

  // Derive live metrics from current state
  const filteredBins = selectedZone === 'all' ? bins : bins.filter(b => b.zone === selectedZone);
  const criticalCount = filteredBins.filter(b => b.status === 'critical').length;
  const urgentCount   = filteredBins.filter(b => b.status === 'warning').length;
  const avgFill       = filteredBins.length > 0
    ? Math.round(filteredBins.reduce((s, b) => s + b.fill, 0) / filteredBins.length)
    : 0;

  const activeCount  = jobs.filter(j => (ACTIVE_JOB_STATES as string[]).includes(j.state)).length;
  const completeToday = jobs.filter(j => j.state === 'COMPLETED').length;

  // Category breakdown from bins
  const categoryBins: Record<string, number> = {};
  filteredBins.forEach(b => {
    categoryBins[b.type] = (categoryBins[b.type] ?? 0) + b.estimated_weight_kg;
  });
  const categoryData = Object.entries(categoryBins).map(([type, kg]) => ({
    label: type.replace('_', '\n'),
    value: Math.round(kg),
    color: CATEGORY_COLOURS[type as keyof typeof CATEGORY_COLOURS] ?? '#808080',
  }));

  // Vehicle utilisation from active jobs
  const vehicleMap: Record<string, { collected: number; total: number }> = {};
  jobs.filter(j => (ACTIVE_JOB_STATES as string[]).includes(j.state)).forEach(j => {
    if (!vehicleMap[j.vehicle_id]) vehicleMap[j.vehicle_id] = { collected: 0, total: 0 };
    vehicleMap[j.vehicle_id].collected += j.bins_collected;
    vehicleMap[j.vehicle_id].total     += j.total_bins;
  });
  const vehicleData = Object.entries(vehicleMap).map(([id, { collected, total }]) => ({
    id,
    pct: total > 0 ? Math.round((collected / total) * 100) : 0,
  }));

  // Fill distribution for heatmap-style chart (bins by fill bucket)
  const fillBuckets = [
    { label: '0–24%',  count: filteredBins.filter(b => b.fill < 25).length,               color: '#22C55E' },
    { label: '25–49%', count: filteredBins.filter(b => b.fill >= 25 && b.fill < 50).length, color: '#4ADE80' },
    { label: '50–74%', count: filteredBins.filter(b => b.fill >= 50 && b.fill < 75).length, color: '#EAB308' },
    { label: '75–89%', count: filteredBins.filter(b => b.fill >= 75 && b.fill < 90).length, color: '#F97316' },
    { label: '90%+',   count: filteredBins.filter(b => b.fill >= 90).length,               color: '#EF4444' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Zone filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>ZONE:</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setSelectedZone('all')}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${selectedZone === 'all' ? 'var(--accent)' : 'var(--border)'}`,
              background: selectedZone === 'all' ? 'rgba(34,211,197,0.1)' : 'var(--bg-card)',
              color: selectedZone === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            All Zones
          </button>
          {zones.map(z => (
            <button
              key={z.id}
              onClick={() => setSelectedZone(z.id)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${selectedZone === z.id ? z.color : 'var(--border)'}`,
                background: selectedZone === z.id ? `${z.color}18` : 'var(--bg-card)',
                color: selectedZone === z.id ? z.color : 'var(--text-muted)',
              }}
            >
              {z.name}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row — live metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <StatCard label="TOTAL BINS"            value={filteredBins.length}     color="var(--info)"/>
        <StatCard label="AVG FILL LEVEL"        value={avgFill}  unit="%" color="var(--accent)"/>
        <StatCard label="CRITICAL BINS"         value={criticalCount}           color="var(--critical)"/>
        <StatCard label="ACTIVE JOBS"           value={activeCount}             color="#22C55E"/>
        <StatCard label="COMPLETED TODAY"       value={completeToday}           color="var(--ok)"/>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Chart 1 — Waste by category */}
        <ChartCard title="ESTIMATED WASTE BY CATEGORY" badge="live">
          {categoryData.length === 0 ? (
            <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No bin data loaded yet
            </div>
          ) : (
            <>
              <VerticalBarChart data={categoryData}/>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 12 }}>
                {categoryData.map(({ label, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }}/>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {label.replace('\n', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Chart 2 — Fill distribution */}
        <ChartCard title="BIN FILL DISTRIBUTION" badge="live">
          <VerticalBarChart data={fillBuckets.map(b => ({ label: b.label, value: b.count, color: b.color }))}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>Low fill → High fill</span>
            <span>{filteredBins.length} bins total</span>
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Chart 3 — Weekly collections */}
        <ChartCard title="WEEKLY COLLECTIONS">
          <VerticalBarChart
            data={weeklyCollections.map(w => ({ label: w.day, value: w.count }))}
            getColor={() => 'var(--accent)'}
          />
        </ChartCard>

        {/* Chart 4 — Alert breakdown */}
        <ChartCard title="ALERTS BY TYPE">
          <VerticalBarChart
            data={alertsByType.map(a => ({
              label: a.type,
              value: a.count,
              color: a.type === 'escalated' ? '#EF4444' : a.type === 'urgent' ? '#F97316' : '#EAB308',
            }))}
          />
        </ChartCard>
      </div>

      {/* Vehicle utilisation */}
      {vehicleData.length > 0 && (
        <ChartCard title="VEHICLE JOB PROGRESS" badge="live">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px' }}>
            {vehicleData.map(({ id, pct }) => (
              <HorizBar
                key={id}
                label={id}
                value={pct}
                color={pct > 85 ? '#F97316' : pct > 60 ? '#22C55E' : '#6B7280'}
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* Fill rate by zone */}
      {fillRateByZone.length > 0 && (
        <ChartCard title="AVERAGE FILL RATE BY ZONE">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px' }}>
            {fillRateByZone.map(z => {
              const zone = zoneMap[z.zone];
              return (
                <HorizBar
                  key={z.zone}
                  label={zone?.name ?? z.zone}
                  value={z.avg}
                  color={zone?.color ?? 'var(--accent)'}
                />
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* Zone summary table */}
      {zones.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0 }}>
            {['ZONE', 'BINS', 'AVG FILL', 'CRITICAL', 'URGENT', 'ACTIVE JOBS'].map(col => (
              <div key={col} style={{ flex: 1, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{col}</div>
            ))}
          </div>
          {zones.map((zone, i) => {
            const zoneBins    = bins.filter(b => b.zone === zone.id);
            const zoneAvgFill = zoneBins.length > 0 ? Math.round(zoneBins.reduce((s, b) => s + b.fill, 0) / zoneBins.length) : 0;
            const zoneCrit    = zoneBins.filter(b => b.status === 'critical').length;
            const zoneUrgent  = zoneBins.filter(b => b.status === 'warning').length;
            const zoneJobs    = jobs.filter(j => j.zone_id === zone.id && (ACTIVE_JOB_STATES as string[]).includes(j.state)).length;
            return (
              <div key={zone.id} style={{
                display: 'flex', alignItems: 'center', padding: '12px 20px',
                borderBottom: i < zones.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: zone.color, flexShrink: 0 }}/>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{zone.name}</span>
                </div>
                <div style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{zone.binCount}</div>
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: zoneAvgFill >= 75 ? '#EF4444' : zoneAvgFill >= 50 ? '#EAB308' : '#22C55E',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                    {zoneAvgFill}%
                  </span>
                </div>
                <div style={{ flex: 1, fontSize: 11, color: zoneCrit > 0 ? '#EF4444' : 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{zoneCrit}</div>
                <div style={{ flex: 1, fontSize: 11, color: zoneUrgent > 0 ? '#F97316' : 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{zoneUrgent}</div>
                <div style={{ flex: 1, fontSize: 11, color: zoneJobs > 0 ? '#22C55E' : 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{zoneJobs}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
