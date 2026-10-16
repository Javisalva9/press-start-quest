import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { ReviewService } from './review.service.js';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, ReviewService],
})
export class LibraryModule {}
