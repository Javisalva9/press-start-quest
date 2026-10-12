import { Module } from '@nestjs/common';
import { IgdbApi } from './igdb-api.js';

@Module({
  providers: [IgdbApi],
  exports: [IgdbApi],
})
export class IgdbModule {}
