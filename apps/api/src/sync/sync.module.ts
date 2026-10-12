import { Module } from '@nestjs/common';
import { IgdbModule } from '../providers/igdb/igdb.module.js';
import { SteamModule } from '../providers/steam/steam.module.js';
import { CatalogEnricher } from './catalog-enricher.js';
import { LibraryImporter } from './library-importer.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [SteamModule, IgdbModule],
  controllers: [SyncController],
  providers: [SyncService, LibraryImporter, CatalogEnricher],
})
export class SyncModule {}
