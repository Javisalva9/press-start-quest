import { Module } from '@nestjs/common';
import { SteamLibraryProvider } from './steam-library.provider.js';
import { SteamWebApi } from './steam-web-api.js';

@Module({
  providers: [SteamWebApi, SteamLibraryProvider],
  exports: [SteamWebApi, SteamLibraryProvider],
})
export class SteamModule {}
