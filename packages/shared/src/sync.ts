import { z } from 'zod';
import { ErrorCodeSchema } from './errors.js';

/** Same values as the JobStatus enum in the database. */
export const SYNC_JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'DONE',
  'FAILED',
] as const;

export const SyncJobStatusSchema = z.enum(SYNC_JOB_STATUSES);

export type SyncJobStatus = z.infer<typeof SyncJobStatusSchema>;

/** What a sync found and changed. */
export const SyncStatsSchema = z.object({
  /** Entries in the Steam library, games or not. */
  gamesFound: z.number().int().nonnegative(),
  /** Entries that weren't in the user's library before this sync. */
  gamesAdded: z.number().int().nonnegative(),
  /** Entries whose playtime or last session changed. */
  playtimeUpdated: z.number().int().nonnegative(),
  /** DLC, demos, Playtests, soundtracks and tools (hidden in the library). */
  notGames: z.number().int().nonnegative(),
  // The defaults keep jobs saved before these fields existed valid.
  /** Catalog entries filled with Steam Store and IGDB data in this sync. */
  enriched: z.number().int().nonnegative().default(0),
  /** Games in the library with no known length (IGDB coverage). */
  withoutDuration: z.number().int().nonnegative().default(0),
  /** Games in the Steam wishlist ("Lo quiero"). */
  wishlistItems: z.number().int().nonnegative().default(0),
  /** Games whose achievements were read in this sync. */
  achievementsRead: z.number().int().nonnegative().default(0),
});

export type SyncStats = z.infer<typeof SyncStatsSchema>;

/** Response of POST /api/sync and GET /api/sync/jobs/:id. */
export const SyncJobSchema = z.object({
  id: z.string(),
  status: SyncJobStatusSchema,
  /** 0–100. */
  progress: z.number().int().min(0).max(100),
  stats: SyncStatsSchema.nullable(),
  /** Why it failed, when status is FAILED. */
  error: ErrorCodeSchema.nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});

export type SyncJob = z.infer<typeof SyncJobSchema>;
