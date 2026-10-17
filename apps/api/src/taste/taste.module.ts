import { Module } from '@nestjs/common';
import { TasteProfileController } from './taste-profile.controller.js';
import { TasteProfileService } from './taste-profile.service.js';

/**
 * The taste profile. Its own small module: the sync and the library
 * refresh it after changing statuses, and the recommendations read it.
 */
@Module({
  controllers: [TasteProfileController],
  providers: [TasteProfileService],
  exports: [TasteProfileService],
})
export class TasteModule {}
