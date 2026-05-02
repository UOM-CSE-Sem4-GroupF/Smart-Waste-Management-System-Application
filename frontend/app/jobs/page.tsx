'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BINS, MOCK_JOBS } from '@/mock';
import type { Bin } from '@/lib/types';

type JobStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED' | 'CANCELLED';

interface Job {
  id: string;
  label: string;
  driver: string;
  vehicle: string;
  status: JobStatus;
  progress: number; // 0-100
  stops: { binId: string; order: number; completed: boolean }[];
  distanceKm: number;
  durationMin: number;
  createdAt: number;
  completedAt?: number;
  zone: string;
  wasteType: string;
}

function StatusBadge({ status }: { status: JobStatus }) {
  const colors = {
    IN_PROGRESS: 'var(--accent)',
    COMPLETED: 'var(--ok)',
    ESCALATED: 'var(--critical)',
    CANCELLED: 'var(--text-muted)',
  };

  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: colors[status],
      border: `1px solid ${colors[status]}`,
      borderRadius: 4,
      padding: '2px 8px',
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ActiveJobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const completedStops = job.stops.filter(s => s.completed).length;
  const totalStops = job.stops.length;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {job.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {job.id}
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Progress</span>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{job.progress}%</span>
        </div>
        <div style={{
          width: '100%',
          height: 6,
          background: 'var(--bg-surface)',
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${job.progress}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}/>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Driver</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{job.driver}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vehicle</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{job.vehicle}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stops</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            {completedStops}/{totalStops}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Distance</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{job.distanceKm} km</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{job.durationMin} min</div>
        </div>
      </div>
    </div>
  );
}

function CompletedJobsTable({ jobs, onJobClick }: { jobs: Job[]; onJobClick: (job: Job) => void }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          Completed Jobs
        </h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Job ID
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Route
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Driver
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Completed
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Duration
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr
                key={job.id}
                onClick={() => onJobClick(job)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {job.id}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                  {job.label}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                  {job.driver}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                  {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                  {job.durationMin} min
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={job.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobDetailDrawer({ job, onClose }: { job: Job | null; onClose: () => void }) {
  if (!job) return null;

  const binMap = Object.fromEntries(BINS.map(b => [b.id, b]));

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: 400,
      height: '100vh',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
      zIndex: 1000,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Job Details
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: 'var(--bg-surface)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {job.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {job.id}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <StatusBadge status={job.status} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Driver</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{job.driver}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vehicle</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{job.vehicle}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Progress
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              flex: 1,
              height: 8,
              background: 'var(--bg-surface)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${job.progress}%`,
                height: '100%',
                background: job.status === 'ESCALATED' ? 'var(--critical)' : 'var(--accent)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}/>
            </div>
            <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
              {job.progress}%
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Stops ({job.stops.filter(s => s.completed).length}/{job.stops.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {job.stops.map(stop => {
              const bin = binMap[stop.binId];
              return (
                <div
                  key={stop.binId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    borderRadius: 6,
                    border: stop.completed ? '1px solid var(--ok)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: stop.completed ? 'var(--ok)' : 'var(--text-muted)',
                  }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                      Stop {stop.order}: {bin?.label || stop.binId}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Fill: {bin?.fill}% • {bin?.type}
                    </div>
                  </div>
                  {stop.completed && (
                    <div style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600 }}>
                      ✓ Completed
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Job Info
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Distance</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{job.distanceKm} km</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Duration</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{job.durationMin} min</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Created</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                {new Date(job.createdAt).toLocaleString()}
              </div>
            </div>
            {job.completedAt && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Completed</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {new Date(job.completedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const activeJobs = MOCK_JOBS.filter(job => job.status === 'IN_PROGRESS');
  const completedJobs = MOCK_JOBS.filter(job => job.status === 'COMPLETED');

  return (
    <div style={{ padding: '20px', background: 'var(--bg-app)', minHeight: '100vh', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Jobs Management
              </h1>
              <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                Monitor active collection jobs and view completed operations
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Active Jobs */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Active Jobs ({activeJobs.length})
          </h2>
          {activeJobs.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
              {activeJobs.map(job => (
                <ActiveJobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
              ))}
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text-muted)',
            }}>
              No active jobs at the moment
            </div>
          )}
        </div>

        {/* Completed Jobs */}
        {completedJobs.length > 0 && (
          <div>
            <CompletedJobsTable jobs={completedJobs} onJobClick={setSelectedJob} />
          </div>
        )}

        {/* Job Detail Drawer */}
        <JobDetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />
      </div>
    </div>
  );
}