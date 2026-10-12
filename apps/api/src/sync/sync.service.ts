import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ErrorCodeSchema,
  SyncStatsSchema,
  type ApiError,
  type SyncJob,
} from '@psq/shared';
import {
  JobStatus,
  type SyncJob as SyncJobRow,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LibraryImporter } from './library-importer.js';
import { SyncError } from './sync-error.js';

const ACTIVE: JobStatus[] = [JobStatus.QUEUED, JobStatus.RUNNING];

/**
 * Runs syncs in the background: the first one can take minutes because of
 * the external APIs' limits, far longer than an HTTP request should last.
 * POST /sync creates a job and answers at once; the web app then polls its
 * progress.
 *
 * Jobs run inside this API process. That's enough for a single instance
 * (Render's free plan); with several, a real queue would be needed.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  /** Jobs running in this process right now. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly importer: LibraryImporter,
  ) {}

  /** Starts a sync, or returns the one already running for this user. */
  async start(userId: string): Promise<SyncJob> {
    const active = await this.prisma.syncJob.findFirst({
      where: { userId, status: { in: ACTIVE } },
      orderBy: { createdAt: 'desc' },
    });
    if (active && this.running.has(active.id)) {
      return toSyncJob(active);
    }
    if (active) {
      await this.markInterruptedIfStillActive(active.id);
    }

    const job = await this.prisma.syncJob.create({ data: { userId } });
    this.running.add(job.id);
    // Not awaited on purpose: it goes on after the response is sent.
    // run() never throws: every error ends up in the job.
    void this.run(job.id, userId);
    return toSyncJob(job);
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
    if (ACTIVE.includes(job.status) && !this.running.has(job.id)) {
      // "Running" in the database but not in this process: the API was
      // restarted (a deploy, or Render waking up) halfway through.
      return toSyncJob(await this.markInterruptedIfStillActive(job.id));
    }
    return toSyncJob(job);
  }

  private async run(jobId: string, userId: string): Promise<void> {
    try {
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: { status: JobStatus.RUNNING, startedAt: new Date(), progress: 5 },
      });
      const stats = await this.importer.importSteam(
        userId,
        async (progress) => {
          await this.prisma.syncJob.update({
            where: { id: jobId },
            data: { progress },
          });
        },
      );
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.DONE,
          progress: 100,
          stats,
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      const code = error instanceof SyncError ? error.code : 'SYNC_FAILED';
      this.logger.error(
        `Sync ${jobId} failed (${code}): ${(error as Error).message}`,
      );
      await this.prisma.syncJob
        .update({
          where: { id: jobId },
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
      this.running.delete(jobId);
    }
  }

  /**
   * Conditional update: if the job finished a moment ago, it's left as is
   * and the finished job is returned instead.
   */
  private async markInterruptedIfStillActive(
    jobId: string,
  ): Promise<SyncJobRow> {
    await this.prisma.syncJob.updateMany({
      where: { id: jobId, status: { in: ACTIVE } },
      data: {
        status: JobStatus.FAILED,
        error: 'SYNC_INTERRUPTED',
        finishedAt: new Date(),
      },
    });
    return this.prisma.syncJob.findUniqueOrThrow({ where: { id: jobId } });
  }
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
