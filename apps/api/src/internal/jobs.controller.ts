import { Controller, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Platform } from '../generated/prisma/client.js';
import { Public } from '../auth/public.decorator.js';
import {
  PricesService,
  type PriceRunSummary,
} from '../deals/prices.service.js';
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
  /**
   * The night's prices, after the syncs (a game bought today is no longer
   * wanted). Null without ITAD_API_KEY; an error doesn't fail the night:
   * the playtime photos matter more.
   */
  prices: PriceRunSummary | { error: string } | null;
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
    private readonly prices: PricesService,
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
      prices: null,
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
    if (this.prices.enabled) {
      summary.prices = await this.prices.refresh().catch((error: unknown) => {
        this.logger.error(`Prices failed: ${String(error)}`);
        return { error: error instanceof Error ? error.name : 'Error' };
      });
    }
    this.logger.log(`Nightly sync: ${JSON.stringify(summary)}`);
    return summary;
  }

  /** Only the prices: to try them, or to catch up a night. */
  @Post('prices')
  @HttpCode(200)
  async refreshPrices(): Promise<PriceRunSummary | { skipped: string }> {
    if (!this.prices.enabled) {
      return { skipped: 'ITAD_API_KEY is not set' };
    }
    return this.prices.refresh();
  }
}
