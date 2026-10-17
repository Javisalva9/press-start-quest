import { Injectable } from '@nestjs/common';
import type { ExternalSource } from '@psq/shared';
import { Platform } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The stores the player added by hand, to pick one when adding a game. */
@Injectable()
export class ExternalSourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ExternalSource[]> {
    const sources = await this.prisma.source.findMany({
      where: { userId, platform: Platform.EXTERNAL },
      select: {
        id: true,
        displayName: true,
        _count: { select: { ownerships: true } },
      },
      orderBy: { displayName: 'asc' },
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.displayName ?? '',
      games: source._count.ownerships,
    }));
  }
}
