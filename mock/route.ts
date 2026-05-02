import type { Route } from '@/lib/types';

export const ROUTE: Route = {
  id: 'RT-042',
  label: 'Morning Run — Zone 1 & 2',
  driver: 'R. Santos',
  vehicle: 'TRK-07',
  distanceKm: 18.4,
  durationMin: 95,
  status: 'active',
  stops: [
    { binId: 'BIN-001', order: 1, eta: '07:15' },
    { binId: 'BIN-009', order: 2, eta: '07:28' },
    { binId: 'BIN-007', order: 3, eta: '07:40' },
    { binId: 'BIN-003', order: 4, eta: '07:55' },
    { binId: 'BIN-002', order: 5, eta: '08:10' },
    { binId: 'BIN-006', order: 6, eta: '08:25' },
  ],
};
