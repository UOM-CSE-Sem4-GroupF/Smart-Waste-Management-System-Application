'use client';

import { useState } from 'react';
import type { Job, JobState, JobType } from '@/lib/types';
import { JOB_STATE_COLOURS, ACTIVE_JOB_STATES, TERMINAL_JOB_STATES } from '@/lib/types';

interface Props { jobs: Job[] }

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }}/>
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", minWidth: 36 }}>
        {value}/{max}
      </span>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const color = JOB_STATE_COLOURS[state] ?? '#6B7280';
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      color, border: `1px solid ${color}`, borderRadius: 4, padding: '2px 7px',
      background: `${color}18`,
    }}>
      {state.replace(/_/g, ' ')}
    </span>
  );
}

function TypeBadge({ type }: { type: JobType }) {
  const isEmergency = type === 'emergency';
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
      color: isEmergency ? '#EF4444' : '#3B82F6',
      border: `1px solid ${isEmergency ? '#EF4444' : '#3B82F6'}`,
      borderRadius: 4, padding: '2px 7px',
      background: isEmergency ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
    }}>
      {isEmergency ? '🚨 Emergency' : 'Routine'}
    </span>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ── Job detail drawer ─────────────────────────────────────────────────────────

function JobDetailDrawer({ job, onClose }: { job: Job; onClose: () => void }) {
  const stateColor = JOB_STATE_COLOURS[job.state] ?? '#6B7280';
  const binPct   = job.total_bins > 0 ? Math.round((job.bins_collected / job.total_bins) * 100) : 0;
  const cargoPct = job.cargo_limit_kg > 0 ? Math.round((job.cargo_weight_kg / job.cargo_limit_kg) * 100) : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position: 'relative', width: 560, maxWidth: '90vw', height: '100%',
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <TypeBadge type={job.job_type}/>
              <StateBadge state={job.state}/>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              {job.zone_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
              {job.id}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-card)', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Assignment */}
          <div>
            <SectionTitle>Assignment</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              <InfoRow label="Vehicle"    value={job.vehicle_id}/>
              <InfoRow label="Driver"     value={job.driver_id}/>
              <InfoRow label="Started"    value={formatTime(job.created_at)}/>
              {job.completed_at && <InfoRow label="Completed" value={formatTime(job.completed_at)}/>}
              {job.duration_minutes !== undefined && job.duration_minutes > 0 && (
                <InfoRow label="Duration" value={formatDuration(job.duration_minutes)}/>
              )}
            </div>
          </div>

          {/* Progress */}
          <div>
            <SectionTitle>Progress</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Bins collected</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{binPct}%</span>
                </div>
                <ProgressBar value={job.bins_collected} max={job.total_bins} color="#22C55E"/>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Cargo weight</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{cargoPct}%</span>
                </div>
                <ProgressBar
                  value={Math.round(job.actual_weight_kg ?? job.cargo_weight_kg)}
                  max={job.cargo_limit_kg}
                  color={cargoPct > 90 ? '#EF4444' : cargoPct > 70 ? '#EAB308' : '#22C55E'}
                />
              </div>
              {job.bins_skipped !== undefined && job.bins_skipped > 0 && (
                <div style={{ fontSize: 11, color: '#EAB308' }}>
                  {job.bins_skipped} bin{job.bins_skipped !== 1 ? 's' : ''} skipped
                </div>
              )}
            </div>
          </div>

          {/* State timeline */}
          <div>
            <SectionTitle>State Timeline</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {job.state_history.map((entry, i) => {
                const color = JOB_STATE_COLOURS[entry.state] ?? '#6B7280';
                const isLast = i === job.state_history.length - 1;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 12, position: 'relative' }}>
                    {/* Line */}
                    {!isLast && (
                      <div style={{
                        position: 'absolute', left: 7, top: 18, bottom: 0,
                        width: 1, background: 'var(--border)',
                      }}/>
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 15, height: 15, borderRadius: '50%',
                      background: color, border: `2px solid ${color}44`,
                      flexShrink: 0, marginTop: 1,
                    }}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 1 }}>
                        {entry.state.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {formatTime(entry.ts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)',
      textTransform: 'uppercase', marginBottom: 10,
      paddingBottom: 6, borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
    </div>
  );
}

// ── Active job card ───────────────────────────────────────────────────────────

function ActiveJobCard({ job, onSelect }: { job: Job; onSelect: () => void }) {
  const stateColor = JOB_STATE_COLOURS[job.state] ?? '#6B7280';
  const binPct     = job.total_bins > 0 ? Math.round((job.bins_collected / job.total_bins) * 100) : 0;
  const cargoPct   = job.cargo_limit_kg > 0 ? Math.round((job.cargo_weight_kg / job.cargo_limit_kg) * 100) : 0;
  const cargoColor = cargoPct > 90 ? '#EF4444' : cargoPct > 70 ? '#EAB308' : '#22C55E';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${stateColor}44`,
      borderLeft: `3px solid ${stateColor}`,
      borderRadius: 10, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <TypeBadge type={job.job_type}/>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{job.zone_name}</span>
          </div>
          <StateBadge state={job.state}/>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
          Started {formatTime(job.created_at)}
        </div>
      </div>

      {/* Vehicle + driver */}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--accent)' }}>{job.vehicle_id}</span>
        <span style={{ color: 'var(--border-hi)', margin: '0 6px' }}>·</span>
        {job.driver_id}
      </div>

      {/* Progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Bins: {job.bins_collected} / {job.total_bins} ({binPct}%)
          </div>
          <ProgressBar value={job.bins_collected} max={job.total_bins} color="#22C55E"/>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Cargo: {Math.round(job.cargo_weight_kg)} / {job.cargo_limit_kg} kg ({cargoPct}%)
          </div>
          <ProgressBar value={Math.round(job.cargo_weight_kg)} max={job.cargo_limit_kg} color={cargoColor}/>
        </div>
      </div>

      <button
        onClick={onSelect}
        style={{
          alignSelf: 'flex-end', padding: '5px 12px', borderRadius: 6, fontSize: 11,
          fontWeight: 600, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--bg-input)',
          color: 'var(--text-secondary)',
        }}
      >
        View details →
      </button>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function JobsView({ jobs }: Props) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [completedFilter, setCompletedFilter] = useState<'all' | 'routine' | 'emergency'>('all');

  const activeJobs    = jobs.filter(j => (ACTIVE_JOB_STATES as string[]).includes(j.state));
  const completedJobs = jobs.filter(j => (TERMINAL_JOB_STATES as string[]).includes(j.state));

  const filteredCompleted = completedJobs.filter(j =>
    completedFilter === 'all' || j.job_type === completedFilter
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Active Jobs',    value: activeJobs.length,     color: '#22C55E' },
          { label: 'Escalated',      value: activeJobs.filter(j => j.state === 'ESCALATED').length, color: '#EF4444' },
          { label: 'Completed Today',value: completedJobs.filter(j => j.state === 'COMPLETED').length, color: 'var(--accent)' },
          { label: 'Failed/Cancelled',value: completedJobs.filter(j => j.state === 'FAILED' || j.state === 'CANCELLED').length, color: '#6B7280' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
              {label.toUpperCase()}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16, flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Active jobs */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 10 }}>
            ACTIVE JOBS
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 600,
              background: '#22C55E22', color: '#22C55E',
              border: '1px solid #22C55E44', borderRadius: 10, padding: '1px 8px',
            }}>
              {activeJobs.length}
            </span>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {activeJobs.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
              }}>
                No active jobs — waiting for Kafka events.
              </div>
            ) : (
              activeJobs.map(job => (
                <ActiveJobCard key={job.id} job={job} onSelect={() => setSelectedJob(job)}/>
              ))
            )}
          </div>
        </div>

        {/* Right: Completed jobs */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              COMPLETED JOBS
            </span>
            <div style={{ display: 'flex', gap: 5, marginLeft: 4 }}>
              {(['all', 'routine', 'emergency'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setCompletedFilter(f)}
                  style={{
                    padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${completedFilter === f ? 'var(--accent)' : 'var(--border)'}`,
                    background: completedFilter === f ? 'rgba(34,211,197,0.1)' : 'var(--bg-card)',
                    color: completedFilter === f ? 'var(--accent)' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 0.7fr 0.7fr 0.9fr 0.6fr 0.7fr 0.7fr 0.5fr',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            }}>
              <span>JOB ID</span>
              <span>ZONE</span>
              <span>TYPE</span>
              <span>DRIVER</span>
              <span>BINS</span>
              <span>WEIGHT</span>
              <span>DURATION</span>
              <span>STATE</span>
            </div>

            {/* Table rows */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredCompleted.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No completed jobs yet.
                </div>
              ) : (
                filteredCompleted.map((job, i) => {
                  const stateColor = JOB_STATE_COLOURS[job.state] ?? '#6B7280';
                  return (
                    <div
                      key={job.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 0.7fr 0.7fr 0.9fr 0.6fr 0.7fr 0.7fr 0.5fr',
                        padding: '10px 14px',
                        borderBottom: i < filteredCompleted.length - 1 ? '1px solid var(--border)' : 'none',
                        alignItems: 'center', cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => setSelectedJob(job)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#192236')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {job.id.slice(-8)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{job.zone_name}</span>
                      <span>
                        <TypeBadge type={job.job_type}/>
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{job.driver_id}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {job.bins_collected}/{job.total_bins}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {job.actual_weight_kg ? `${Math.round(job.actual_weight_kg)}kg` : '—'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {job.duration_minutes ? formatDuration(job.duration_minutes) : '—'}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: stateColor,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {job.state}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedJob && (
        <JobDetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)}/>
      )}
    </div>
  );
}
