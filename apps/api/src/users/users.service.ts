import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MeSchema, type ApiError, type Language, type Me } from '@psq/shared';
import { Platform, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the user linked to a Steam account, creating it (with its Steam
   * source) the first time they sign in.
   */
  async findOrCreateBySteamId(
    steamId: string,
    profile: { displayName: string | null; language: Language },
  ): Promise<User> {
    const source = await this.prisma.source.findUnique({
      where: {
        platform_externalId: { platform: Platform.STEAM, externalId: steamId },
      },
      include: { user: true },
    });

    if (source) {
      // Steam names can change at any time: keep ours in sync.
      const { user } = source;
      if (profile.displayName && profile.displayName !== user.displayName) {
        return this.prisma.user.update({
          where: { id: user.id },
          data: { displayName: profile.displayName },
        });
      }
      return user;
    }

    // User and Steam source are created together, in a single query.
    return this.prisma.user.create({
      data: {
        displayName: profile.displayName ?? steamId,
        locale: profile.language,
        sources: { create: { platform: Platform.STEAM, externalId: steamId } },
      },
    });
  }

  /** Profile of the signed-in user. */
  async getMe(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sources: {
          where: { platform: Platform.STEAM },
          select: { externalId: true, lastSyncAt: true },
        },
      },
    });
    if (!user) {
      // Valid token for a user that no longer exists.
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      } satisfies ApiError);
    }
    return MeSchema.parse({
      id: user.id,
      displayName: user.displayName,
      locale: user.locale,
      steamId: user.sources[0]?.externalId ?? null,
      lastSyncAt: user.sources[0]?.lastSyncAt?.toISOString() ?? null,
    });
  }
}
