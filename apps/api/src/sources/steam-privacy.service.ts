import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ApiError, SteamPrivacy } from '@psq/shared';
import { Platform } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  STEAM_PUBLIC_PROFILE,
  SteamWebApi,
} from '../providers/steam/steam-web-api.js';

@Injectable()
export class SteamPrivacyService {
  private readonly logger = new Logger(SteamPrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly steam: SteamWebApi,
  ) {}

  /** Checks whether the user's Steam profile lets the app read their library. */
  async check(userId: string): Promise<SteamPrivacy> {
    const source = await this.prisma.source.findFirst({
      where: { userId, platform: Platform.STEAM },
      select: { externalId: true },
    });
    if (!source) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'STEAM_ACCOUNT_NOT_LINKED',
      } satisfies ApiError);
    }

    try {
      return await this.checkSteamId(source.externalId);
    } catch (error) {
      this.logger.error(
        `Could not check Steam privacy: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'STEAM_UNAVAILABLE',
      } satisfies ApiError);
    }
  }

  private async checkSteamId(steamId: string): Promise<SteamPrivacy> {
    const profile = await this.steam.getPlayerSummary(steamId);
    if (profile?.communityvisibilitystate !== STEAM_PUBLIC_PROFILE) {
      return { status: 'PROFILE_PRIVATE', gameCount: null };
    }

    const library = await this.steam.getOwnedGames(steamId);
    if (!library) {
      return { status: 'GAMES_PRIVATE', gameCount: null };
    }

    // Steam doesn't say "playtime hidden": it just reports 0 for every game.
    // A library where nothing has ever been played is the telltale sign.
    const playtimeHidden =
      library.games.length > 0 &&
      library.games.every((game) => game.playtimeMinutes === 0);
    return {
      status: playtimeHidden ? 'PLAYTIME_HIDDEN' : 'PUBLIC',
      gameCount: library.gameCount,
    };
  }
}
