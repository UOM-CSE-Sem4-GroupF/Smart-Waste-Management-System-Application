import type { AnalyticsData } from '@/lib/types';

export const ANALYTICS: AnalyticsData = {
  weeklyCollections: [
    { day: 'Mon', count: 42 },
    { day: 'Tue', count: 38 },
    { day: 'Wed', count: 55 },
    { day: 'Thu', count: 47 },
    { day: 'Fri', count: 61 },
    { day: 'Sat', count: 29 },
    { day: 'Sun', count: 18 },
  ],
  fillRateByZone: [
    { zone: 'Downtown Core', avg: 62 },
    { zone: 'Harbour District', avg: 58 },
    { zone: 'East Suburbs', avg: 45 },
    { zone: 'Industrial South', avg: 48 },
  ],
  alertsByType: [
    { type: 'critical', count: 8 },
    { type: 'warning', count: 21 },
    { type: 'info', count: 14 },
  ],
  totalCollectionsThisMonth: 487,
  avgFillOnCollection: 76,
  fuelSavedLitres: 312,
  co2SavedKg: 748,
};
