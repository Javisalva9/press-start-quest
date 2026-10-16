import { Module } from '@nestjs/common';
import { IgdbModule } from '../providers/igdb/igdb.module.js';
import { SteamModule } from '../providers/steam/steam.module.js';
import { AchievementsImporter } from './achievements-importer.js';
import { CatalogEnricher } from './catalog-enricher.js';
import { CompletionDetector } from './completion-detector.js';
import { FinaleRuleUpdater } from './finale-rule-updater.js';
import { GameTypeUpdater } from './game-type-updater.js';
import { LibraryImporter } from './library-importer.js';
import { ServerStatusUpdater } from './server-status-updater.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
import { WishlistImporter } from './wishlist-importer.js';

@Module({
  imports: [SteamModule, IgdbModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    LibraryImporter,
    WishlistImporter,
    CatalogEnricher,
    GameTypeUpdater,
    ServerStatusUpdater,
    AchievementsImporter,
    FinaleRuleUpdater,
    CompletionDetector,
  ],
})
export class SyncModule {}
