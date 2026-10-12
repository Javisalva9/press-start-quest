import { Module } from '@nestjs/common';
import { SteamModule } from '../providers/steam/steam.module.js';
import { LibraryImporter } from './library-importer.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [SteamModule],
  controllers: [SyncController],
  providers: [SyncService, LibraryImporter],
})
export class SyncModule {}
