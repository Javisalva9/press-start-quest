import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module.js';
import { SyncModule } from '../sync/sync.module.js';
import { JobsController } from './jobs.controller.js';
import { JobsTokenGuard } from './jobs-token.guard.js';

/** Scheduled jobs: the nightly sync and the prices. */
@Module({
  imports: [SyncModule, DealsModule],
  controllers: [JobsController],
  providers: [JobsTokenGuard],
})
export class InternalModule {}
