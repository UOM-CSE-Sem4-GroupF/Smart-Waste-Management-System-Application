import { Prisma } from '@prisma/client';
import prisma from './prisma';

export interface DbDriver {
  id:                 string;
  name:               string;
  zone_id:            number;
  current_vehicle_id: string | null;
  status:             string;
}

export interface DbBinRecord {
  id:                       string;
  job_id:                   string;
  bin_id:                   string;
  cluster_id:               string;
  sequence_number:          number;
  planned_arrival_at:       Date | null;
  arrived_at:               Date | null;
  collected_at:             Date | null;
  skipped_at:               Date | null;
  skip_reason:              string | null;
  fill_level_at_collection: Prisma.Decimal | null;
  estimated_weight_kg:      Prisma.Decimal | null;
  actual_weight_kg:         Prisma.Decimal | null;
  driver_notes:             string | null;
  photo_url:                string | null;
}

// ── Drivers ────────────────────────────────────────────────────────────────

export async function getDriverByVehicle(vehicle_id: string): Promise<DbDriver | null> {
  return prisma.driver.findFirst({
    where: { current_vehicle_id: vehicle_id },
  });
}

export async function setDriverStatus(driver_id: string, status: string): Promise<void> {
  await prisma.driver.update({
    where: { id: driver_id },
    data:  { status },
  });
}

export async function getAllDrivers(params?: {
  zone_id?: number;
  limit?:   number;
  offset?:  number;
}): Promise<{ drivers: DbDriver[]; total: number }> {
  const where = params?.zone_id ? { zone_id: params.zone_id } : undefined;
  const limit  = Math.min(params?.limit  ?? 50, 200);
  const offset = params?.offset ?? 0;

  const [drivers, total] = await Promise.all([
    prisma.driver.findMany({ where, orderBy: { id: 'asc' }, take: limit, skip: offset }),
    prisma.driver.count({ where }),
  ]);
  return { drivers, total };
}

export async function getDriverById(driver_id: string): Promise<DbDriver | null> {
  return prisma.driver.findUnique({ where: { id: driver_id } });
}

export async function createDriver(payload: {
  id:                 string;
  name:               string;
  zone_id?:           number;
  current_vehicle_id?: string | null;
}): Promise<DbDriver> {
  return prisma.driver.create({
    data: {
      id:                 payload.id,
      name:               payload.name,
      zone_id:            payload.zone_id ?? 0,
      current_vehicle_id: payload.current_vehicle_id ?? null,
      status:             'off_duty',
    },
  });
}

export async function updateDriver(
  driver_id: string,
  patch: Partial<{
    name:               string;
    zone_id:            number;
    current_vehicle_id: string | null;
    status:             string;
  }>,
): Promise<DbDriver | null> {
  try {
    return await prisma.driver.update({
      where: { id: driver_id },
      data:  patch,
    });
  } catch (e: any) {
    if (e?.code === 'P2025') return null;
    throw e;
  }
}

// ── Bin collection records ─────────────────────────────────────────────────

export async function createBinCollectionRecords(
  job_id: string,
  bins: Array<{
    bin_id:             string;
    cluster_id:         string;
    sequence:           number;
    planned_arrival_at: string | null;
    estimated_weight_kg: number;
  }>,
): Promise<void> {
  await prisma.binCollectionRecord.createMany({
    data: bins.map((b) => ({
      job_id,
      bin_id:              b.bin_id,
      cluster_id:          b.cluster_id,
      sequence_number:     b.sequence,
      planned_arrival_at:  b.planned_arrival_at ? new Date(b.planned_arrival_at) : null,
      estimated_weight_kg: b.estimated_weight_kg,
    })),
    skipDuplicates: true,
  });
}

export async function getBinRecords(job_id: string): Promise<DbBinRecord[]> {
  return prisma.binCollectionRecord.findMany({
    where:   { job_id },
    orderBy: { sequence_number: 'asc' },
  });
}

export async function getBinRecord(job_id: string, bin_id: string): Promise<DbBinRecord | null> {
  return prisma.binCollectionRecord.findUnique({
    where: { job_id_bin_id: { job_id, bin_id } },
  });
}

export async function updateBinRecord(
  job_id: string,
  bin_id: string,
  patch: Partial<{
    arrived_at:               string;
    collected_at:             string;
    fill_level_at_collection: number;
    actual_weight_kg:         number;
    gps_lat:                  number;
    gps_lng:                  number;
    gps_accuracy_m:           number;
    driver_notes:             string;
    photo_url:                string;
    skipped_at:               string;
    skip_reason:              string;
    skip_notes:               string;
  }>,
): Promise<void> {
  const data: Prisma.BinCollectionRecordUpdateInput = {};
  if (patch.arrived_at               !== undefined) data.arrived_at               = new Date(patch.arrived_at);
  if (patch.collected_at             !== undefined) data.collected_at             = new Date(patch.collected_at);
  if (patch.fill_level_at_collection !== undefined) data.fill_level_at_collection = patch.fill_level_at_collection;
  if (patch.actual_weight_kg         !== undefined) data.actual_weight_kg         = patch.actual_weight_kg;
  if (patch.gps_lat                  !== undefined) data.gps_lat                  = patch.gps_lat;
  if (patch.gps_lng                  !== undefined) data.gps_lng                  = patch.gps_lng;
  if (patch.gps_accuracy_m           !== undefined) data.gps_accuracy_m           = patch.gps_accuracy_m;
  if (patch.driver_notes             !== undefined) data.driver_notes             = patch.driver_notes;
  if (patch.photo_url                !== undefined) data.photo_url                = patch.photo_url;
  if (patch.skipped_at               !== undefined) data.skipped_at               = new Date(patch.skipped_at);
  if (patch.skip_reason              !== undefined) data.skip_reason              = patch.skip_reason;
  if (patch.skip_notes               !== undefined) data.skip_notes               = patch.skip_notes;

  await prisma.binCollectionRecord.update({
    where: { job_id_bin_id: { job_id, bin_id } },
    data,
  });
}

// ── Driver assignment history ──────────────────────────────────────────────

export async function recordAssignment(params: {
  job_id:           string;
  driver_id:        string;
  vehicle_id:       string;
  assignment_type:  'offered' | 'accepted' | 'rejected' | 'released';
  rejection_reason?: string;
}): Promise<void> {
  await prisma.driverAssignmentHistory.create({
    data: {
      job_id:          params.job_id,
      driver_id:       params.driver_id,
      vehicle_id:      params.vehicle_id,
      assignment_type: params.assignment_type,
      rejection_reason: params.rejection_reason,
    },
  });
}

// ── Job lookup for release ─────────────────────────────────────────────────

export async function getJobAssignment(
  job_id: string,
): Promise<{ assigned_vehicle_id: string | null; assigned_driver_id: string | null } | null> {
  const row = await prisma.collectionJob.findUnique({
    where:  { id: job_id },
    select: { assigned_vehicle_id: true, assigned_driver_id: true },
  });
  return row ?? null;
}
