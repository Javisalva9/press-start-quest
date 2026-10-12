import { Module } from '@nestjs/common';
import { SteamLibraryProvider } from './steam-library.provider.js';
import { SteamStoreApi } from './steam-store-api.js';
import { SteamWebApi } from './steam-web-api.js';

@Module({
  providers: [SteamWebApi, SteamLibraryProvider, SteamStoreApi],
  exports: [SteamWebApi, SteamLibraryProvider, SteamStoreApi],
})
export class SteamModule {}
