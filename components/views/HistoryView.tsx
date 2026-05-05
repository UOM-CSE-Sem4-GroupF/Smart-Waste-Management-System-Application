'use client';

import { useState } from 'react';

interface SearchParams {
  binId:    string;
  jobId:    string;
  driver:   string;
  vehicle:  string;
  zone:     string;
  dateFrom: string;
  dateTo:   string;
}

const EMPTY_PARAMS: SearchParams = {
  binId: '', jobId: '', driver: '', vehicle: '', zone: '', dateFrom: '', dateTo: '',
};

type ResultRow = {
  id:          string;
  date:        string;
  zone:        string;
  type:        string;
  state:       string;
  driver:      string;
  bins:        string;
  weight:      string;
  duration:    string;
  txId?:       string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

async function searchJobs(params: SearchParams): Promise<ResultRow[]> {
  const query = new URLSearchParams();
  if (params.jobId)    query.set('job_id',   params.jobId);
  if (params.zone)     query.set('zone_id',  params.zone);
  if (params.driver)   query.set('driver_id',params.driver);
  if (params.dateFrom) query.set('date_from',params.dateFrom);
  if (params.dateTo)   query.set('date_to',  params.dateTo);

  const res = await fetch(`${API_BASE}/api/v1/collection-jobs?${query}`);
  if (!res.ok) return [];

  const data = await res.json();
  const items: unknown[] = Array.isArray(data) ? data : (data.data ?? []);
  return (items as Record<string, unknown>[]).map(j => ({
    id:       String(j.job_id ?? j.id ?? ''),
    date:     j.created_at ? new Date(String(j.created_at)).toLocaleDateString('en-GB') : '—',
    zone:     String(j.zone_id ?? '—'),
    type:     String(j.job_type ?? 'routine'),
    state:    String(j.state ?? '—'),
    driver:   String(j.driver_id ?? '—'),
    bins:     j.bins_collected !== undefined ? `${j.bins_collected}/${j.total_bins ?? '?'}` : '—',
    weight:   j.actual_weight_kg ? `${Math.round(Number(j.actual_weight_kg))} kg` : '—',
    duration: j.duration_minutes ? `${j.duration_minutes}m` : '—',
    txId:     j.blockchain_tx_id ? String(j.blockchain_tx_id) : undefined,
  }));
}

async function searchBinHistory(binId: string): Promise<ResultRow[]> {
  const res = await fetch(`${API_BASE}/api/v1/bins/${binId}/history`);
  if (!res.ok) return [];

  const data = await res.json();
  const items: unknown[] = Array.isArray(data) ? data : (data.data ?? []);
  return (items as Record<string, unknown>[]).map(e => ({
    id:       String(e.job_id ?? ''),
    date:     e.collected_at ? new Date(String(e.collected_at)).toLocaleDateString('en-GB') : '—',
    zone:     String(e.zone_id ?? '—'),
    type:     String(e.job_type ?? '—'),
    state:    'COMPLETED',
    driver:   String(e.driver_id ?? '—'),
    bins:     '—',
    weight:   e.weight_kg ? `${Math.round(Number(e.weight_kg))} kg` : '—',
    duration: '—',
  }));
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => { /* ignore */ });
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: cols.map(() => '1fr').join(' '),
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
    }}>
      {cols.map(c => <span key={c}>{c}</span>)}
    </div>
  );
}

function StateTag({ state }: { state: string }) {
  const color = state === 'COMPLETED' ? '#22C55E'
    : state === 'FAILED' || state === 'CANCELLED' ? '#6B7280'
    : state === 'ESCALATED' ? '#EF4444'
    : '#3B82F6';
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {state}
    </span>
  );
}

export default function HistoryView() {
  const [params, setParams]     = useState<SearchParams>(EMPTY_PARAMS);
  const [loading, setLoading]   = useState(false);
  const [jobResults, setJobResults]   = useState<ResultRow[] | null>(null);
  const [binResults, setBinResults]   = useState<ResultRow[] | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);

  function set(key: keyof SearchParams, val: string) {
    setParams(p => ({ ...p, [key]: val }));
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setJobResults(null);
    setBinResults(null);
    try {
      if (params.binId.trim()) {
        const rows = await searchBinHistory(params.binId.trim());
        setBinResults(rows);
      } else {
        const rows = await searchJobs(params);
        setJobResults(rows);
      }
    } catch (e) {
      setError('Search failed — check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(txId: string) {
    copyToClipboard(txId);
    setCopied(txId);
    setTimeout(() => setCopied(null), 2000);
  }

  const inputStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '8px 12px', color: 'var(--text-primary)',
    fontSize: 12, outline: 'none', width: '100%',
  };
  const labelStyle = { fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search form */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 16 }}>
          SEARCH HISTORY
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={labelStyle}>BIN ID</div>
            <input
              value={params.binId}
              onChange={e => set('binId', e.target.value)}
              placeholder="e.g. BIN-047"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>JOB ID</div>
            <input
              value={params.jobId}
              onChange={e => set('jobId', e.target.value)}
              placeholder="e.g. job-abc123"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>DRIVER ID</div>
            <input
              value={params.driver}
              onChange={e => set('driver', e.target.value)}
              placeholder="e.g. DRV-007"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>ZONE</div>
            <input
              value={params.zone}
              onChange={e => set('zone', e.target.value)}
              placeholder="e.g. zone-1"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={labelStyle}>DATE FROM</div>
            <input
              type="date"
              value={params.dateFrom}
              onChange={e => set('dateFrom', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>DATE TO</div>
            <input
              type="date"
              value={params.dateTo}
              onChange={e => set('dateTo', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: '9px 20px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--accent)', background: 'rgba(34,211,197,0.15)',
                color: 'var(--accent)', opacity: loading ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button
              onClick={() => { setParams(EMPTY_PARAMS); setJobResults(null); setBinResults(null); setError(null); }}
              style={{
                padding: '9px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--bg-input)',
                color: 'var(--text-muted)',
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', color: '#EF4444', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Job results */}
      {jobResults !== null && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              JOBS — {jobResults.length} result{jobResults.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <TableHeader cols={['DATE', 'ZONE', 'TYPE', 'STATE', 'DRIVER', 'BINS', 'WEIGHT', 'DURATION', 'BLOCKCHAIN TX']}/>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {jobResults.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No results found. Try adjusting your search parameters.
                </div>
              ) : (
                jobResults.map((row, i) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 0.6fr 0.6fr 0.8fr 0.8fr 0.5fr 0.6fr 0.6fr 1fr',
                      padding: '10px 16px', fontSize: 11,
                      borderBottom: i < jobResults.length - 1 ? '1px solid var(--border)' : 'none',
                      alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#192236')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{row.date}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{row.zone}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      color: row.type === 'emergency' ? '#EF4444' : '#3B82F6',
                    }}>{row.type}</span>
                    <StateTag state={row.state}/>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{row.driver}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{row.bins}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{row.weight}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{row.duration}</span>
                    <span>
                      {row.txId ? (
                        <button
                          onClick={() => handleCopy(row.txId!)}
                          style={{
                            fontSize: 9, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                            border: '1px solid #8B5CF6', background: 'rgba(139,92,246,0.1)',
                            color: copied === row.txId ? '#22C55E' : '#8B5CF6',
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                          title={row.txId}
                        >
                          {copied === row.txId ? '✓ Copied' : `${row.txId.slice(0, 8)}… ⧉`}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bin history results */}
      {binResults !== null && (
        <div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              BIN {params.binId.toUpperCase()} — COLLECTION HISTORY — {binResults.length} result{binResults.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <TableHeader cols={['DATE', 'JOB ID', 'ZONE', 'TYPE', 'DRIVER', 'WEIGHT']}/>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {binResults.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No collection history for bin {params.binId}.
                </div>
              ) : (
                binResults.map((row, i) => (
                  <div
                    key={`${row.id}-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 0.6fr 0.6fr 0.8fr 0.6fr',
                      padding: '10px 16px', fontSize: 11,
                      borderBottom: i < binResults.length - 1 ? '1px solid var(--border)' : 'none',
                      alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#192236')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{row.date}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{row.id || '—'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{row.zone}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: row.type === 'emergency' ? '#EF4444' : '#3B82F6' }}>{row.type}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{row.driver}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{row.weight}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state before any search */}
      {jobResults === null && binResults === null && !loading && !error && (
        <div style={{
          padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          lineHeight: 1.8,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Search historical records</div>
          <div style={{ fontSize: 12, maxWidth: 400, margin: '0 auto' }}>
            Search by Bin ID to see collection history, or use Job ID, driver, zone, and date range to retrieve past collection jobs.
          </div>
        </div>
      )}
    </div>
  );
}
