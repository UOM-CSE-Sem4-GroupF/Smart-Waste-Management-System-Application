import type { Vehicle } from '@/lib/types';

export const VEHICLES: Vehicle[] = [
  {
    id: 'TRK-07',
    lat: 14.5980,
    lng: 120.9820,
    heading: 45,
    speed: 32,
    routeId: 'RT-042',
    lastUpdate: Date.now() - 10000,
  },
  {
    id: 'TRK-12',
    lat: 14.5900,
    lng: 120.9750,
    heading: 110,
    speed: 27,
    routeId: 'RT-043',
    lastUpdate: Date.now() - 14500,
  },
  {
    id: 'TRK-09',
    lat: 14.6050,
    lng: 121.0010,
    heading: 270,
    speed: 18,
    routeId: 'RT-044',
    lastUpdate: Date.now() - 22000,
  },
];
