import prisma from './prisma';

const TERMINAL = ['COMPLETED', 'CANCELLED', 'FAILED', 'ESCALATED', 'AUDIT_FAILED'];

export async function hasActiveJobForCluster(cluster_id: string): Promise<boolean> {
  const found = await prisma.emergencyJobDetails.findFirst({
    where: {
      OR: [
        { trigger_cluster_id: cluster_id },
        { cluster_ids: { has: cluster_id } },
      ],
      job: { state: { notIn: TERMINAL } },
    },
    select: { job_id: true },
  });
  return found !== null;
}

export async function hasActiveJobForBin(bin_id: string): Promise<boolean> {
  const found = await prisma.emergencyJobDetails.findFirst({
    where: {
      OR: [
        { trigger_bin_id: bin_id },
        { bin_ids: { has: bin_id } },
      ],
      job: { state: { notIn: TERMINAL } },
    },
    select: { job_id: true },
  });
  return found !== null;
}
