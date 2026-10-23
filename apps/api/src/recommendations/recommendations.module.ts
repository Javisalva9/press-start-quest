import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module.js';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';

/** "Your next game": reads the taste profile the sync keeps up to date. */
@Module({
  imports: [LibraryModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
