import { Module } from '@nestjs/common';
import { SteamModule } from '../providers/steam/steam.module.js';
import { ExternalSourcesService } from './external-sources.service.js';
import { SourcesController } from './sources.controller.js';
import { SteamPrivacyService } from './steam-privacy.service.js';

@Module({
  imports: [SteamModule],
  controllers: [SourcesController],
  providers: [SteamPrivacyService, ExternalSourcesService],
})
export class SourcesModule {}
