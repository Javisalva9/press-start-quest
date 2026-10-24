import { Module } from '@nestjs/common';
import { GamerPowerApi } from './gamerpower-api.js';

@Module({
  providers: [GamerPowerApi],
  exports: [GamerPowerApi],
})
export class GamerPowerModule {}
