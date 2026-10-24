import { Module } from '@nestjs/common';
import { ItadApi } from './itad-api.js';

@Module({
  providers: [ItadApi],
  exports: [ItadApi],
})
export class ItadModule {}
