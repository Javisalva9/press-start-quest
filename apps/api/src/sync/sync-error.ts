import type { ErrorCode } from '@psq/shared';

/** A sync failed for a known reason, saved as the job's error code. */
export class SyncError extends Error {
  constructor(
    readonly code: ErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Sync failed: ${code}`, options);
  }
}
