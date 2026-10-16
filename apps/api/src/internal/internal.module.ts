import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module.js';
import { JobsController } from './jobs.controller.js';
import { JobsTokenGuard } from './jobs-token.guard.js';

/** Scheduled jobs: the nightly sync, later the deals search. */
@Module({
  imports: [SyncModule],
  controllers: [JobsController],
  providers: [JobsTokenGuard],
})
export class InternalModule {}
