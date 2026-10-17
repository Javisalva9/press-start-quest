import {
  Injectable,
  Logger,
  NotFoundException,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import {
  ErrorCodeSchema,
  SyncStatsSchema,
  type ApiError,
  type SyncJob,
  type SyncStats,
} from '@psq/shared';
import {
  JobStatus,
  Prisma,
  type SyncJob as SyncJobRow,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasteProfileService } from '../taste/taste-profile.service.js';
import { AchievementsImporter } from './achievements-importer.js';
import { AutoStatusUpdater } from './auto-status-updater.js';
import { CatalogEnricher } from './catalog-enricher.js';
import { CompletionDetector } from './completion-detector.js';
import { FinaleRuleUpdater } from './finale-rule-updater.js';
import { GameTypeUpdater } from './game-type-updater.js';
import { LibraryImporter } from './library-importer.js';
import { ServerStatusUpdater } from './server-status-updater.js';
import { SnapshotRecorder } from './snapshot-recorder.js';
import { gamingDay } from './gaming-day.js';
import { WishlistImporter } from './wishlist-importer.js';
import { SyncError } from './sync-error.js';

const ACTIVE: JobStatus[] = [JobStatus.QUEUED, JobStatus.RUNNING];

/** A running job writes at least this often, even if its progress doesn't move. */
export const HEARTBEAT_MS = 30_000;

/** An active job silent for this long (4 missed heartbeats) is dead. */
export const STALE_AFTER_MS = 2 * 60_000;

/** Ends a job that is no longer running: interrupted, or already finished. */
class JobNoLongerActiveError extends Error {}

/**
 * Runs syncs in the background: the first one can take minutes because of
 * the external APIs' limits, far longer than an HTTP request should last.
 * POST /sync creates a job and answers at once; the web app then polls its
 * progress.
 *
 * Jobs run inside an API process, but whether a job is alive is decided by
 * the database, not by that process's memory: during a deploy, Render runs
 * the old and the new instance side by side, and either one may answer the
 * web app's polls. A job is alive while it keeps writing (`updatedAt`).
 */
@Injectable()
export class SyncService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(SyncService.name);
  /** Jobs this process runs, to close them if it's shut down. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly importer: LibraryImporter,
    private readonly wishlist: WishlistImporter,
    private readonly enricher: CatalogEnricher,
    private readonly gameTypes: GameTypeUpdater,
    private readonly serverStatus: ServerStatusUpdater,
    private readonly achievements: AchievementsImporter,
    private readonly finaleRules: FinaleRuleUpdater,
    private readonly completions: CompletionDetector,
    private readonly statuses: AutoStatusUpdater,
    private readonly snapshots: SnapshotRecorder,
    private readonly taste: TasteProfileService,
  ) {}

  /** Starts a sync, or returns the one already running for this user. */
  async start(userId: string): Promise<SyncJob> {
    const { job, done } = await this.begin(userId);
    // Not awaited on purpose: it goes on after the response is sent.
    // run() never throws: every error ends up in the job.
    void done;
    return job;
  }

  /**
   * For the nightly job: starts a sync and waits until it's over, so the
   * request that asked for it keeps the API awake meanwhile. Null if one
   * was already running for this user (started from their phone).
   */
  async runAndWait(userId: string): Promise<SyncJob | null> {
    const { job, done } = await this.begin(userId);
    if (!done) {
      return null;
    }
    await done;
    return toSyncJob(
      await this.prisma.syncJob.findUniqueOrThrow({ where: { id: job.id } }),
    );
  }

  /** Creates the job and starts it; `done` is null if one was running. */
  private async begin(
    userId: string,
  ): Promise<{ job: SyncJob; done: Promise<void> | null }> {
    const active = await this.findActive(userId);
    if (active && !isStale(active)) {
      return { job: toSyncJob(active), done: null };
    }
    if (active) {
      await this.markInterruptedIfStale(active.id);
    }

    let job: SyncJobRow;
    try {
      job = await this.prisma.syncJob.create({ data: { userId } });
    } catch (error) {
      // The unique index allows one active job per user: another request
      // (a double tap, a second tab) created it a moment ago.
      const winner = isUniqueViolation(error)
        ? await this.findActive(userId)
        : null;
      if (winner) {
        return { job: toSyncJob(winner), done: null };
      }
      throw error;
    }

    this.running.add(job.id);
    return { job: toSyncJob(job), done: this.run(job.id, userId) };
  }

  async getJob(userId: string, jobId: string): Promise<SyncJob> {
    const job = await this.prisma.syncJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'SYNC_JOB_NOT_FOUND',
      } satisfies ApiError);
    }
    if (isStale(job)) {
      // Active but silent: the process running it died without saying so
      // (a crash, or a kill with no time to clean up).
      return toSyncJob(await this.markInterruptedIfStale(job.id));
    }
    return toSyncJob(job);
  }

  /**
   * Render sends SIGTERM before stopping an instance (a deploy, or going to
   * sleep). The jobs this process runs are closed as interrupted right away,
   * so the web app doesn't wait 2 minutes to find out.
   *
   * beforeApplicationShutdown, not onApplicationShutdown: Nest runs the
   * shutdown phases in order (onModuleDestroy, beforeApplicationShutdown,
   * onApplicationShutdown), and Prisma disconnects in the last one.
   */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    if (this.running.size === 0) {
      return;
    }
    const ids = [...this.running];
    try {
      const { count } = await this.prisma.syncJob.updateMany({
        where: { id: { in: ids }, status: { in: ACTIVE } },
        data: interrupted(),
      });
      this.logger.warn(
        `Shutting down (${signal ?? 'no signal'}): ${count} sync(s) marked as interrupted`,
      );
    } catch (error) {
      // The 2-minute safety net will close them anyway.
      this.logger.error(
        `Could not mark syncs as interrupted on shutdown: ${(error as Error).message}`,
      );
    }
  }

  private async run(jobId: string, userId: string): Promise<void> {
    // Every write is conditional on the job still running: once a job is
    // finished or declared interrupted, nothing can bring it back.
    const stillRunning = { id: jobId, status: JobStatus.RUNNING };
    let active = true;

    const heartbeat = setInterval(() => {
      this.prisma.syncJob
        .updateMany({ where: stillRunning, data: { updatedAt: new Date() } })
        .then(({ count }) => {
          if (count === 0) {
            active = false;
          }
        })
        .catch((error: unknown) =>
          this.logger.warn(
            `Heartbeat of sync ${jobId} failed: ${(error as Error).message}`,
          ),
        );
    }, HEARTBEAT_MS);
    // Never keeps the process alive on its own.
    heartbeat.unref();

    // Progress only moves forward, and is only saved when it changes.
    let saved = 0;
    const progress = async (value: number) => {
      if (!active) {
        throw new JobNoLongerActiveError();
      }
      const rounded = Math.min(99, Math.round(value));
      if (rounded > saved) {
        saved = rounded;
        const { count } = await this.prisma.syncJob.updateMany({
          where: stillRunning,
          data: { progress: rounded },
        });
        if (count === 0) {
          active = false;
          throw new JobNoLongerActiveError();
        }
      }
    };

    try {
      const { count } = await this.prisma.syncJob.updateMany({
        where: { id: jobId, status: JobStatus.QUEUED },
        data: { status: JobStatus.RUNNING, startedAt: new Date(), progress: 5 },
      });
      if (count === 0) {
        throw new JobNoLongerActiveError();
      }
      // Each step gets a share of the bar matching how long it usually takes:
      // the Steam Store (wishlist names, enrichment) is the slow part.
      const imported = await this.importer.importSteam(userId, (value) =>
        progress(5 + value * 0.1),
      );
      // Playtime history: today's photo of what changed.
      await this.snapshots.record(
        userId,
        imported.touchedUserGameIds,
        gamingDay(new Date()),
      );
      const { wishlistItems } = await this.wishlist.importSteam(
        userId,
        (fraction) => progress(15 + fraction * 15),
      );
      const { enriched } = await this.enricher.enrich(userId, (fraction) =>
        progress(30 + fraction * 55),
      );
      // Read only the catalog just saved: fast, no progress share needed.
      await this.gameTypes.update(userId);
      await this.serverStatus.update(userId);
      const { achievementsRead } = await this.achievements.importSteam(
        userId,
        imported.touchedUserGameIds,
        (fraction) => progress(85 + fraction * 13),
      );
      // Needs the achievements just read; both only read our database.
      await this.finaleRules.update(userId);
      await this.completions.update(userId);
      await this.statuses.update(userId);
      // With the statuses settled, the taste follows them. It never fails
      // the sync: it's derived data, worked out again next time.
      await this.taste.refresh(userId);
      const coverage = await this.enricher.coverage(userId);
      const stats: SyncStats = {
        ...imported.stats,
        ...coverage,
        enriched,
        wishlistItems,
        achievementsRead,
      };

      await this.prisma.syncJob.updateMany({
        where: stillRunning,
        data: {
          status: JobStatus.DONE,
          progress: 100,
          stats,
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof JobNoLongerActiveError) {
        this.logger.warn(`Sync ${jobId} stopped: it is no longer active`);
        return;
      }
      const code = error instanceof SyncError ? error.code : 'SYNC_FAILED';
      this.logger.error(
        `Sync ${jobId} failed (${code}): ${(error as Error).message}`,
      );
      await this.prisma.syncJob
        .updateMany({
          where: { id: jobId, status: { in: ACTIVE } },
          data: {
            status: JobStatus.FAILED,
            error: code,
            finishedAt: new Date(),
          },
        })
        .catch((saveError: unknown) =>
          this.logger.error(
            `Could not save the failure of sync ${jobId}: ${(saveError as Error).message}`,
          ),
        );
    } finally {
      clearInterval(heartbeat);
      this.running.delete(jobId);
    }
  }

  private findActive(userId: string): Promise<SyncJobRow | null> {
    return this.prisma.syncJob.findFirst({
      where: { userId, status: { in: ACTIVE } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Conditional update: if the job wrote again a moment ago, or has just
   * finished, it's left as is and returned as it stands.
   */
  private async markInterruptedIfStale(jobId: string): Promise<SyncJobRow> {
    await this.prisma.syncJob.updateMany({
      where: {
        id: jobId,
        status: { in: ACTIVE },
        updatedAt: { lt: staleBefore() },
      },
      data: interrupted(),
    });
    return this.prisma.syncJob.findUniqueOrThrow({ where: { id: jobId } });
  }
}

function staleBefore(): Date {
  return new Date(Date.now() - STALE_AFTER_MS);
}

function isStale(job: SyncJobRow): boolean {
  return ACTIVE.includes(job.status) && job.updatedAt < staleBefore();
}

function interrupted() {
  return {
    status: JobStatus.FAILED,
    error: 'SYNC_INTERRUPTED',
    finishedAt: new Date(),
  } satisfies Prisma.SyncJobUpdateManyMutationInput;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function toSyncJob(job: SyncJobRow): SyncJob {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    stats: job.stats ? SyncStatsSchema.parse(job.stats) : null,
    error: job.error
      ? ErrorCodeSchema.catch('SYNC_FAILED').parse(job.error)
      : null,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}
