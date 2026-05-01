'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BINS, ZONES, MOCK_COLLECTION_HISTORY } from '@/mock';
import type { Bin } from '@/lib/types';

type JobStatus = 'COMPLETED' | 'CANCELLED';

interface CollectionJob {
  id: string;
  label: string;
  driver: string;
  vehicle: string;
  status: JobStatus;
  stops: { binId: string; order: number; completed: boolean }[];
  distanceKm: number;
  durationMin: number;
  createdAt: number;
  completedAt: number;
  zone: string;
  wasteType: string;
  totalWeightKg: number;
}

function getZoneName(zoneId: string): string {
  return ZONES.find(z => z.id === zoneId)?.name || zoneId;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    binId: '',
    jobId: '',
    zone: '',
    startDate: '',
    endDate: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredJobs = MOCK_COLLECTION_HISTORY.filter(job => {
    if (filters.binId && !job.stops.some(stop => stop.binId.toLowerCase().includes(filters.binId.toLowerCase()))) {
      return false;
    }
    if (filters.jobId && !job.id.toLowerCase().includes(filters.jobId.toLowerCase())) {
      return false;
    }
    if (filters.zone && job.zone !== filters.zone) {
      return false;
    }
    if (filters.startDate && new Date(job.completedAt) < new Date(filters.startDate)) {
      return false;
    }
    if (filters.endDate && new Date(job.completedAt) > new Date(filters.endDate + 'T23:59:59')) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    // UI only - no actual export functionality
    alert('Export functionality would be implemented here');
  };

  return (
    <div style={{ padding: '20px', background: 'var(--bg-app)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Collection History
              </h1>
              <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                View and search completed collection jobs and their details
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
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Search Filters */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px',
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Search Filters
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>
                Bin ID
              </label>
              <input
                type="text"
                placeholder="e.g. BIN-001"
                value={filters.binId}
                onChange={(e) => setFilters(prev => ({ ...prev, binId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>
                Job ID
              </label>
              <input
                type="text"
                placeholder="e.g. JOB-001"
                value={filters.jobId}
                onChange={(e) => setFilters(prev => ({ ...prev, jobId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>
                Zone
              </label>
              <select
                value={filters.zone}
                onChange={(e) => setFilters(prev => ({ ...prev, zone: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              >
                <option value="">All Zones</option>
                {ZONES.map(zone => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setFilters({ binId: '', jobId: '', zone: '', startDate: '', endDate: '' })}
              style={{
                padding: '10px 20px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Clear Filters
            </button>

            <button
              onClick={handleExport}
              style={{
                padding: '10px 20px',
                border: '1px solid var(--accent)',
                borderRadius: 6,
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              📊 Export Data
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                Collection Jobs ({filteredJobs.length})
              </h2>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)' }}>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Job ID
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Label
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Driver
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Zone
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Bins Collected
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Weight (kg)
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Duration
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Completed
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedJobs.map(job => (
                  <tr key={job.id} style={{
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                  }}>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}>
                      {job.id}
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}>
                      {job.label}
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}>
                      {job.driver}
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}>
                      {getZoneName(job.zone)}
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}>
                      {job.stops.filter(s => s.completed).length}/{job.stops.length}
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}>
                      {job.totalWeightKg}
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}>
                      {job.durationMin}m
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}>
                      {formatDate(job.completedAt)}<br/>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatTime(job.completedAt)}
                      </span>
                    </td>
                    <td style={{
                      padding: '16px',
                      fontSize: 14,
                      color: job.status === 'COMPLETED' ? 'var(--ok)' : 'var(--critical)',
                      fontWeight: 500,
                    }}>
                      {job.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: '20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: currentPage === 1 ? 'var(--bg-surface)' : 'var(--bg-card)',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                ‹ Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: currentPage === page ? 'var(--accent)' : 'var(--bg-card)',
                    color: currentPage === page ? 'white' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: currentPage === page ? 600 : 400,
                  }}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: currentPage === totalPages ? 'var(--bg-surface)' : 'var(--bg-card)',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                Next ›
              </button>
            </div>
          )}
        </div>

        {filteredJobs.length === 0 && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '60px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              No collection jobs found
            </div>
            <div style={{ fontSize: '14px' }}>
              Try adjusting your search filters to see more results.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}