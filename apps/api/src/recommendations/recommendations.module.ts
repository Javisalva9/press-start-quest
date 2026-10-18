import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';

/** "Your next game": reads the taste profile the sync keeps up to date. */
@Module({
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
