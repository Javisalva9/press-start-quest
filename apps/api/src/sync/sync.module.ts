import { Module } from '@nestjs/common';
import { FinaleModule } from '../finale/finale.module.js';
import { IgdbModule } from '../providers/igdb/igdb.module.js';
import { SteamModule } from '../providers/steam/steam.module.js';
import { TasteModule } from '../taste/taste.module.js';
import { AchievementsImporter } from './achievements-importer.js';
import { AutoStatusUpdater } from './auto-status-updater.js';
import { CatalogEnricher } from './catalog-enricher.js';
import { CompletionDetector } from './completion-detector.js';
import { FinaleRuleUpdater } from './finale-rule-updater.js';
import { GameTypeUpdater } from './game-type-updater.js';
import { LibraryImporter } from './library-importer.js';
import { ServerStatusUpdater } from './server-status-updater.js';
import { SnapshotRecorder } from './snapshot-recorder.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
import { WishlistImporter } from './wishlist-importer.js';

@Module({
  imports: [SteamModule, IgdbModule, FinaleModule, TasteModule],
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
    AutoStatusUpdater,
    SnapshotRecorder,
  ],
  // The nightly job (internal module) runs syncs too.
  exports: [SyncService, CompletionDetector],
})
export class SyncModule {}
