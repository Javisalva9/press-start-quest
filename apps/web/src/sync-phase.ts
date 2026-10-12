import type { SyncJob } from '@psq/shared';

export type SyncPhase =
  | 'queued'
  | 'library'
  | 'wishlist'
  | 'details'
  | 'achievements'
  | 'done'
  | 'failed';

/**
 * What the sync is doing, from its progress. The ranges mirror how the API
 * splits the bar (SyncService): library 5–15 %, wishlist 15–30 %,
 * details 30–85 %, achievements 85–100 %.
 */
export function syncPhase(
  job: Pick<SyncJob, 'status' | 'progress'>,
): SyncPhase {
  if (job.status === 'DONE') {
    return 'done';
  }
  if (job.status === 'FAILED') {
    return 'failed';
  }
  if (job.status === 'QUEUED' || job.progress < 5) {
    return 'queued';
  }
  if (job.progress < 15) {
    return 'library';
  }
  if (job.progress < 30) {
    return 'wishlist';
  }
  if (job.progress < 85) {
    return 'details';
  }
  return 'achievements';
}
