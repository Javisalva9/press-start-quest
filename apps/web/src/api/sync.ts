import { useMutation, useQuery } from '@tanstack/react-query';
import { SyncJobSchema, type SyncJob } from '@psq/shared';
import { authRequest } from './client';

export async function startSync(): Promise<SyncJob> {
  return SyncJobSchema.parse(
    await authRequest('/api/sync', { method: 'POST' }),
  );
}

export async function fetchSyncJob(id: string): Promise<SyncJob> {
  return SyncJobSchema.parse(
    await authRequest(`/api/sync/jobs/${encodeURIComponent(id)}`),
  );
}

export function isSyncActive(job: SyncJob | undefined): boolean {
  return job?.status === 'QUEUED' || job?.status === 'RUNNING';
}

export function useStartSync() {
  return useMutation({ mutationFn: startSync });
}

/**
 * A sync job, asked again every 1.5 s while it runs. The polling also keeps
 * the API on Render awake until the sync is over.
 */
export function useSyncJob(id: string | undefined) {
  return useQuery({
    queryKey: ['sync-job', id],
    queryFn: () => fetchSyncJob(id ?? ''),
    enabled: id !== undefined,
    refetchInterval: (query) => (isSyncActive(query.state.data) ? 1500 : false),
  });
}
