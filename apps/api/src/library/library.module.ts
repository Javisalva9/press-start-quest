import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { FinaleModule } from '../finale/finale.module.js';
import { GamesController } from './games.controller.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { ManualGamesService } from './manual-games.service.js';
import { ReviewService } from './review.service.js';

@Module({
  imports: [CatalogModule, FinaleModule],
  controllers: [LibraryController, GamesController],
  providers: [LibraryService, ReviewService, ManualGamesService],
})
export class LibraryModule {}
