import { Module } from '@nestjs/common';
import { IgdbModule } from '../providers/igdb/igdb.module.js';
import { GamesController } from './games.controller.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { ManualGamesService } from './manual-games.service.js';
import { ReviewService } from './review.service.js';

@Module({
  imports: [IgdbModule],
  controllers: [LibraryController, GamesController],
  providers: [LibraryService, ReviewService, ManualGamesService],
})
export class LibraryModule {}
