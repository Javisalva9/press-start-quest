import { Module } from '@nestjs/common';
import { FinaleModule } from '../finale/finale.module.js';
import { SyncModule } from '../sync/sync.module.js';
import { AchievementsController } from './achievements.controller.js';
import { AchievementsService } from './achievements.service.js';

@Module({
  imports: [FinaleModule, SyncModule],
  controllers: [AchievementsController],
  providers: [AchievementsService],
})
export class AchievementsModule {}
