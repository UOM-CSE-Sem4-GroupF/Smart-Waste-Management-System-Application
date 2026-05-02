'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BINS, ZONES } from '@/mock';
import type { Bin, Zone, BinStatus, WasteType } from '@/lib/types';

const STATUS_OPTIONS: BinStatus[] = ['ok', 'warning', 'critical'];
const WASTE_TYPES: WasteType[] = ['general', 'recycling', 'organic', 'hazardous'];

function FilterPanel({
  selectedZones,
  setSelectedZones,
  selectedStatuses,
  setSelectedStatuses,
  selectedTypes,
  setSelectedTypes
}: {
  selectedZones: string[];
  setSelectedZones: (zones: string[]) => void;
  selectedStatuses: BinStatus[];
  setSelectedStatuses: (statuses: BinStatus[]) => void;
  selectedTypes: WasteType[];
  setSelectedTypes: (types: WasteType[]) => void;
}) {
  const toggleZone = (zoneId: string) => {
    setSelectedZones(
      selectedZones.includes(zoneId)
        ? selectedZones.filter(id => id !== zoneId)
        : [...selectedZones, zoneId]
    );
  };

  const toggleStatus = (status: BinStatus) => {
    setSelectedStatuses(
      selectedStatuses.includes(status)
        ? selectedStatuses.filter(s => s !== status)
        : [...selectedStatuses, status]
    );
  };

  const toggleType = (type: WasteType) => {
    setSelectedTypes(
      selectedTypes.includes(type)
        ? selectedTypes.filter(t => t !== type)
        : [...selectedTypes, type]
    );
  };

  return (
    <div style={{
      width: 280,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      padding: '20px',
      overflowY: 'auto',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
        Filters
      </h3>

      {/* Zones */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
          Zones
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ZONES.map(zone => (
            <label key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedZones.includes(zone.id)}
                onChange={() => toggleZone(zone.id)}
                style={{ accentColor: zone.color }}
              />
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: zone.color, flexShrink: 0
              }}/>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{zone.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
          Status
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STATUS_OPTIONS.map(status => (
            <label key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedStatuses.includes(status)}
                onChange={() => toggleStatus(status)}
              />
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: status === 'critical' ? 'var(--critical)' :
                           status === 'warning' ? 'var(--warning)' : 'var(--ok)',
                flexShrink: 0
              }}/>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {status}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Waste Type */}
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
          Waste Type
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {WASTE_TYPES.map(type => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => toggleType(type)}
              />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {type.replace('_', ' ')}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClusterCard({ bins, onBinClick }: { bins: Bin[]; onBinClick: (bin: Bin) => void }) {
  const avgFill = Math.round(bins.reduce((sum, b) => sum + b.fill, 0) / bins.length);
  const criticalCount = bins.filter(b => b.status === 'critical').length;
  const warningCount = bins.filter(b => b.status === 'warning').length;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '12px',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      minWidth: 200,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
        Cluster ({bins.length} bins)
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Avg Fill: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{avgFill}%</span>
        </div>
        {criticalCount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--critical)' }}>
            ⚠ {criticalCount} critical
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--warning)' }}>
            ⚠ {warningCount} warning
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {bins.slice(0, 5).map(bin => (
          <button
            key={bin.id}
            onClick={(e) => {
              e.stopPropagation();
              onBinClick(bin);
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              fontSize: 11,
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            {bin.id.split('-')[1]}
          </button>
        ))}
        {bins.length > 5 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>
            +{bins.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}

function BinDetailPanel({ bin, onClose }: { bin: Bin | null; onClose: () => void }) {
  if (!bin) return null;

  return (
    <div style={{
      width: 320,
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      padding: '20px',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Bin Details
        </h3>
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: '50%',
            border: 'none', background: 'var(--bg-card)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {bin.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
          ID: {bin.id}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: bin.status === 'critical' ? 'var(--critical)' :
                       bin.status === 'warning' ? 'var(--warning)' : 'var(--ok)',
          }}/>
          <span style={{
            fontSize: 14, fontWeight: 600, textTransform: 'capitalize',
            color: bin.status === 'critical' ? 'var(--critical)' :
                   bin.status === 'warning' ? 'var(--warning)' : 'var(--ok)',
          }}>
            {bin.status}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Fill Level: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{bin.fill}%</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Capacity: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{bin.capacity}L</span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Waste Type
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {bin.type.replace('_', ' ')}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Zone
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          {ZONES.find(z => z.id === bin.zone)?.name || bin.zone}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Battery & Status
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Battery</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: bin.battery < 20 ? 'var(--critical)' : 'var(--text-primary)' }}>
              {bin.battery}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: bin.offline ? 'var(--critical)' : 'var(--ok)' }}>
              {bin.offline ? 'Offline' : 'Online'}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Location
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
          {bin.lat.toFixed(4)}, {bin.lng.toFixed(4)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Last ping: {new Date(bin.lastPing).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  const router = useRouter();
  const [selectedZones, setSelectedZones] = useState<string[]>(ZONES.map(z => z.id));
  const [selectedStatuses, setSelectedStatuses] = useState<BinStatus[]>(['ok', 'warning', 'critical']);
  const [selectedTypes, setSelectedTypes] = useState<WasteType[]>(WASTE_TYPES);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);

  const filteredBins = useMemo(() => {
    return BINS.filter(bin =>
      selectedZones.includes(bin.zone) &&
      selectedStatuses.includes(bin.status) &&
      selectedTypes.includes(bin.type)
    );
  }, [selectedZones, selectedStatuses, selectedTypes]);

  const clusters = useMemo(() => {
    const clusterMap = new Map<string, Bin[]>();
    filteredBins.forEach(bin => {
      const key = bin.zone;
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push(bin);
    });
    return Array.from(clusterMap.values());
  }, [filteredBins]);

  const criticalBins = filteredBins.filter(bin => bin.status === 'critical').length;
  const offlineBins = filteredBins.filter(bin => bin.offline).length;

  const stats = [
    { label: 'Filtered bins', value: filteredBins.length, color: 'var(--accent)' },
    { label: 'Active zones', value: selectedZones.length, color: 'var(--ok)' },
    { label: 'Critical bins', value: criticalBins, color: 'var(--critical)' },
    { label: 'Offline bins', value: offlineBins, color: 'var(--warning)' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden', background: 'var(--bg-app)' }}>
      <FilterPanel
        selectedZones={selectedZones}
        setSelectedZones={setSelectedZones}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Map Operations
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 700, lineHeight: 1.7 }}>
                Explore current bin clusters, zone status, and service readiness in a polished operational map interface.
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                onClick={() => router.push('/')}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Back to Overview
              </button>
              <button
                onClick={() => router.push('/jobs')}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Jobs
              </button>
              <button
                onClick={() => router.push('/analytics')}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Analytics
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {stats.map(stat => (
              <div key={stat.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, minHeight: 108, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {stat.label}
                </span>
                <span style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 20, padding: '0 24px 24px 24px', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)', border: '1px solid rgba(148,163,184,0.12)' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at top left, rgba(56,189,248,0.12), transparent 32%), radial-gradient(circle at bottom right, rgba(34,197,94,0.12), transparent 28%)' }} />
              <div style={{ position: 'absolute', top: 24, left: 24, right: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-muted)', marginBottom: 8 }}>
                    Live Map Preview
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {filteredBins.length} bins · {clusters.length} clusters
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ padding: '10px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                    {selectedStatuses.length} statuses
                  </span>
                  <span style={{ padding: '10px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                    {selectedTypes.length} types
                  </span>
                </div>
              </div>

              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.95)' }}>
                  <div style={{ fontSize: 56, marginBottom: 14 }}>🗺️</div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Map view is ready</div>
                  <div style={{ fontSize: 14, maxWidth: 420, margin: '0 auto', lineHeight: 1.7 }}>
                    This mock map section highlights the dashboard experience without requiring live backend connectivity.
                  </div>
                </div>
              </div>

              <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, display: 'grid', gap: 10 }}>
                {clusters.slice(0, 3).map((clusterBins, index) => (
                  <div key={clusterBins[0].zone + index} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: 16, borderRadius: 18, background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(148,163,184,0.12)' }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Zone {clusterBins[0].zone}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{clusterBins.length} bins</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{clusterBins.filter(b => b.status === 'critical').length} critical</div>
                    </div>
                    <button
                      onClick={() => setSelectedBin(clusterBins[0])}
                      style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#0f1624', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Inspect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ width: 360, minWidth: 360, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
            {selectedBin ? (
              <BinDetailPanel bin={selectedBin} onClose={() => setSelectedBin(null)} />
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Bin details panel</div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  Select a cluster card or bin button to open detailed telemetry, fill level, battery, and location information here.
                </p>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13 }}>
                    <span>Selected bin</span><span>None</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13 }}>
                    <span>Clusters shown</span><span>{clusters.length}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedZones(ZONES.map(z => z.id));
                      setSelectedStatuses(STATUS_OPTIONS);
                      setSelectedTypes(WASTE_TYPES);
                    }}
                    style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
