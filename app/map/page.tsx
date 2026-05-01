'use client';

import { useState, useMemo } from 'react';
import { BINS, ZONES } from '@/lib/mock-data';
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

  // Group bins into clusters (simple grouping by zone for demo)
  const clusters = useMemo(() => {
    const clusterMap = new Map<string, Bin[]>();
    filteredBins.forEach(bin => {
      const key = bin.zone;
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push(bin);
    });
    return Array.from(clusterMap.values());
  }, [filteredBins]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <FilterPanel
        selectedZones={selectedZones}
        setSelectedZones={setSelectedZones}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Map Container */}
        <div style={{
          flex: 1,
          background: '#f0f0f0',
          position: 'relative',
          border: '2px dashed #ccc',
          borderRadius: '8px',
          margin: '20px',
          marginRight: 0,
          marginBottom: 0,
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Interactive Map</div>
            <div style={{ fontSize: '16px' }}>
              Showing {filteredBins.length} bins across {clusters.length} clusters
            </div>
          </div>

          {/* Cluster Cards Overlay */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: 'calc(100% - 40px)',
            overflowY: 'auto',
          }}>
            {clusters.map((clusterBins, index) => (
              <ClusterCard
                key={clusterBins[0].zone + index}
                bins={clusterBins}
                onBinClick={setSelectedBin}
              />
            ))}
          </div>
        </div>
      </div>

      <BinDetailPanel bin={selectedBin} onClose={() => setSelectedBin(null)} />
    </div>
  );
}