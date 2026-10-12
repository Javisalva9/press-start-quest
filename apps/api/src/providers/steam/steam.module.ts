import { Module } from '@nestjs/common';
import { SteamWebApi } from './steam-web-api.js';

@Module({
  providers: [SteamWebApi],
  exports: [SteamWebApi],
})
export class SteamModule {}
