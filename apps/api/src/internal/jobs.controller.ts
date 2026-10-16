import { Controller, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Platform } from '../generated/prisma/client.js';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SyncService } from '../sync/sync.service.js';
import { JobsTokenGuard } from './jobs-token.guard.js';

/** What the nightly run did, for the workflow's log. */
interface DailyRunSummary {
  users: number;
  synced: number;
  /** A sync was already running for them (started from their phone). */
  skipped: number;
  failed: number;
}

/**
 * Routes for scheduled jobs, called by GitHub Actions. Not for people:
 * left out of the API docs, and behind JOBS_TOKEN instead of a user's
 * session (@Public skips the user check; the guard does its own).
 */
@ApiExcludeController()
@Public()
@UseGuards(JobsTokenGuard)
@Controller('internal/jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  /**
   * Syncs every user with a Steam account, one after another, and answers
   * when all are done: the open request keeps the API awake on Render
   * meanwhile, and each sync saves that day's playtime photos.
   */
  @Post('daily')
  @HttpCode(200)
  async daily(): Promise<DailyRunSummary> {
    const users = await this.prisma.user.findMany({
      where: { sources: { some: { platform: Platform.STEAM } } },
      select: { id: true },
    });
    const summary: DailyRunSummary = {
      users: users.length,
      synced: 0,
      skipped: 0,
      failed: 0,
    };
    for (const { id } of users) {
      const job = await this.sync.runAndWait(id);
      if (!job) {
        summary.skipped += 1;
      } else if (job.status === 'DONE') {
        summary.synced += 1;
      } else {
        summary.failed += 1;
      }
    }
    this.logger.log(`Nightly sync: ${JSON.stringify(summary)}`);
    return summary;
  }
}
