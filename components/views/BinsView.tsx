'use client';

import { useState } from 'react';
import FillBar from '@/components/ui/FillBar';
import type { Bin, BinStatus, WasteType } from '@/lib/types';

interface Props { bins: Bin[] }

const STATUS_COLOR: Record<BinStatus, string> = {
  ok: 'var(--ok)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
};

const TYPE_LABEL: Record<WasteType, string> = {
  general:   'General',
  recycling: 'Recycling',
  organic:   'Organic',
  hazardous: 'Hazardous',
};

const TYPE_COLOR: Record<WasteType, string> = {
  general:   '#8494A8',
  recycling: '#60A5FA',
  organic:   '#34D399',
  hazardous: '#FBBF24',
};

export default function BinsView({ bins }: Props) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<BinStatus | 'all'>('all');

  const filtered = bins.filter(b => {
    const matchSearch = b.label.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    ok:       bins.filter(b => b.status === 'ok').length,
    warning:  bins.filter(b => b.status === 'warning').length,
    critical: bins.filter(b => b.status === 'critical').length,
    offline:  bins.filter(b => b.offline).length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Bins',  value: bins.length,    color: 'var(--info)'     },
          { label: 'OK',          value: counts.ok,      color: 'var(--ok)'       },
          { label: 'Warning',     value: counts.warning, color: 'var(--warning)'  },
          { label: 'Critical',    value: counts.critical,color: 'var(--critical)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '16px 20px',
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>
              {label.toUpperCase()}
            </div>
            <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search bins…"
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 14px', color: 'var(--text-primary)',
            fontSize: 12, outline: 'none', width: 220,
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'ok', 'warning', 'critical'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${filterStatus === s ? 'var(--accent)' : 'var(--border)'}`,
                background: filterStatus === s ? 'rgba(34,211,197,0.1)' : 'var(--bg-card)',
                color: filterStatus === s ? 'var(--accent)' : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 0.7fr 1.4fr 0.7fr 0.7fr',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        }}>
          <span>BIN</span><span>ZONE</span><span>TYPE</span><span>FILL</span><span>BATTERY</span><span>STATUS</span>
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {filtered.map((bin, i) => (
            <div
              key={bin.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 1fr 0.7fr 1.4fr 0.7fr 0.7fr',
                padding: '12px 16px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#192236')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{bin.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{bin.id}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{bin.zone}</span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: TYPE_COLOR[bin.type], padding: '2px 7px',
                background: `${TYPE_COLOR[bin.type]}18`, borderRadius: 4, display: 'inline-block',
              }}>
                {TYPE_LABEL[bin.type]}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <FillBar fill={bin.fill}/>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 30, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {bin.fill}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ fontSize: 10 }}>🔋</div>
                <span style={{ fontSize: 11, color: bin.battery < 30 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                  {bin.battery}%
                </span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: bin.offline ? 'var(--text-muted)' : STATUS_COLOR[bin.status],
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {bin.offline ? 'Offline' : bin.status}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No bins match the current filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}