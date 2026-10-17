import { Module } from '@nestjs/common';
import { IgdbModule } from '../providers/igdb/igdb.module.js';
import { IgdbCatalog } from './igdb-catalog.service.js';

/** Catalog games created from IGDB, for whoever needs them. */
@Module({
  imports: [IgdbModule],
  providers: [IgdbCatalog],
  exports: [IgdbCatalog, IgdbModule],
})
export class CatalogModule {}
