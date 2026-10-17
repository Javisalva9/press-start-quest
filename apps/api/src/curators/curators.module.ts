import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CuratorSeeder } from './curator-seeder.js';
import { CuratorsController } from './curators.controller.js';
import { CuratorsService } from './curators.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [CuratorsController],
  providers: [CuratorsService, CuratorSeeder],
})
export class CuratorsModule {}
