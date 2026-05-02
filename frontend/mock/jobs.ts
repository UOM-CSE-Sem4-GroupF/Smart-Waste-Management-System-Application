export interface JobStop {
  binId: string;
  order: number;
  completed: boolean;
}

export interface Job {
  id: string;
  label: string;
  driver: string;
  vehicle: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED' | 'CANCELLED';
  progress: number;
  stops: JobStop[];
  distanceKm: number;
  durationMin: number;
  createdAt: number;
  completedAt?: number;
  zone: string;
  wasteType: string;
  totalWeightKg?: number;
}

export const MOCK_JOBS: Job[] = [
  {
    id: 'JOB-001',
    label: 'Morning Collection - Downtown Core',
    driver: 'R. Santos',
    vehicle: 'TRK-07',
    status: 'IN_PROGRESS',
    progress: 65,
    stops: [
      { binId: 'BIN-001', order: 1, completed: true },
      { binId: 'BIN-009', order: 2, completed: true },
      { binId: 'BIN-007', order: 3, completed: false },
      { binId: 'BIN-003', order: 4, completed: false },
    ],
    distanceKm: 12.4,
    durationMin: 75,
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    zone: 'z1',
    wasteType: 'general',
  },
  {
    id: 'JOB-002',
    label: 'Harbor District Run',
    driver: 'M. Cruz',
    vehicle: 'TRK-12',
    status: 'IN_PROGRESS',
    progress: 52,
    stops: [
      { binId: 'BIN-002', order: 1, completed: true },
      { binId: 'BIN-006', order: 2, completed: false },
    ],
    distanceKm: 8.2,
    durationMin: 45,
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    zone: 'z2',
    wasteType: 'recycling',
  },
  {
    id: 'JOB-003',
    label: 'East Suburbs Full Sweep',
    driver: 'L. Reyes',
    vehicle: 'TRK-09',
    status: 'COMPLETED',
    progress: 100,
    stops: [
      { binId: 'BIN-004', order: 1, completed: true },
      { binId: 'BIN-010', order: 2, completed: true },
      { binId: 'BIN-008', order: 3, completed: true },
    ],
    distanceKm: 15.7,
    durationMin: 92,
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    completedAt: Date.now() - 5 * 24 * 60 * 60 * 1000 + 92 * 60 * 1000,
    zone: 'z3',
    wasteType: 'general',
    totalWeightKg: 312,
  },
  {
    id: 'JOB-004',
    label: 'Industrial South Emergency',
    driver: 'J. Garcia',
    vehicle: 'TRK-15',
    status: 'COMPLETED',
    progress: 100,
    stops: [
      { binId: 'BIN-005', order: 1, completed: true },
    ],
    distanceKm: 6.1,
    durationMin: 28,
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    completedAt: Date.now() - 4 * 24 * 60 * 60 * 1000 + 28 * 60 * 1000,
    zone: 'z4',
    wasteType: 'hazardous',
    totalWeightKg: 89,
  },
  {
    id: 'JOB-005',
    label: 'Downtown Core Afternoon',
    driver: 'R. Santos',
    vehicle: 'TRK-07',
    status: 'COMPLETED',
    progress: 100,
    stops: [
      { binId: 'BIN-001', order: 1, completed: true },
      { binId: 'BIN-009', order: 2, completed: true },
    ],
    distanceKm: 9.8,
    durationMin: 52,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    completedAt: Date.now() - 3 * 24 * 60 * 60 * 1000 + 52 * 60 * 1000,
    zone: 'z1',
    wasteType: 'organic',
    totalWeightKg: 178,
  },
  {
    id: 'JOB-006',
    label: 'Harbor District Evening',
    driver: 'M. Cruz',
    vehicle: 'TRK-12',
    status: 'CANCELLED',
    progress: 0,
    stops: [
      { binId: 'BIN-002', order: 1, completed: false },
    ],
    distanceKm: 4.2,
    durationMin: 0,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    completedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000,
    zone: 'z2',
    wasteType: 'recycling',
    totalWeightKg: 0,
  },
  {
    id: 'JOB-007',
    label: 'East Suburbs Morning',
    driver: 'L. Reyes',
    vehicle: 'TRK-09',
    status: 'COMPLETED',
    progress: 100,
    stops: [
      { binId: 'BIN-004', order: 1, completed: true },
      { binId: 'BIN-010', order: 2, completed: true },
    ],
    distanceKm: 11.3,
    durationMin: 67,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    completedAt: Date.now() - 1 * 24 * 60 * 60 * 1000 + 67 * 60 * 1000,
    zone: 'z1',
    wasteType: 'general',
    totalWeightKg: 234,
  },
];

export const MOCK_COLLECTION_HISTORY = MOCK_JOBS.filter(job => job.status === 'COMPLETED' || job.status === 'CANCELLED');
