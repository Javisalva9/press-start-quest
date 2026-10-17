import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { IgdbCatalog } from '../catalog/igdb-catalog.service.js';
import { CuratorKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadCuratorFiles, type CuratorFile } from './curator-file.js';
import { CuratorsService } from './curators.service.js';

/**
 * Keeps the global curators (data/curators/*.json) in the database: the
 * curator, its games in the catalog (created from IGDB when missing) and
 * its picks. New picks reach the "Lo quiero" of everyone following it.
 *
 * Runs on every start, in the background so the API answers meanwhile;
 * once everything is there it's a couple of quick queries. If IGDB is
 * down, it's logged and tried again on the next start.
 */
@Injectable()
export class CuratorSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(CuratorSeeder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: IgdbCatalog,
    private readonly curators: CuratorsService,
  ) {}

  onApplicationBootstrap(): void {
    // Tests run the app with a fake database and no IGDB.
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    void this.seedAll().catch((error: unknown) =>
      this.logger.error(`Curators not loaded: ${(error as Error).message}`),
    );
  }

  async seedAll(files: CuratorFile[] = loadCuratorFiles()): Promise<void> {
    for (const file of files) {
      await this.seed(file);
    }
  }

  private async seed({ curator: data, games }: CuratorFile): Promise<void> {
    const curator =
      (await this.prisma.curator.findFirst({
        where: { userId: null, name: data.name },
        select: { id: true, color: true },
      })) ??
      (await this.prisma.curator.create({
        data: {
          name: data.name,
          kind: CuratorKind.CREATOR,
          color: data.color ?? null,
        },
        select: { id: true, color: true },
      }));
    if ((data.color ?? null) !== curator.color) {
      await this.prisma.curator.update({
        where: { id: curator.id },
        data: { color: data.color ?? null },
      });
    }

    const found = await this.catalog.ensure(games.map((game) => game.igdbId));
    const gameIds = [...new Set([...found.values()].map((game) => game.id))];
    const added = await this.prisma.curatorPick.createMany({
      data: gameIds.map((gameId) => ({ curatorId: curator.id, gameId })),
      skipDuplicates: true,
    });
    // Out of the list since the last start.
    const removed = await this.prisma.curatorPick.deleteMany({
      where: { curatorId: curator.id, gameId: { notIn: gameIds } },
    });

    if (added.count > 0) {
      const followers = await this.prisma.userCurator.findMany({
        where: { curatorId: curator.id },
        select: { userId: true },
      });
      for (const { userId } of followers) {
        await this.curators.addPicksToWishlist(userId, curator.id);
      }
    }
    if (added.count + removed.count > 0) {
      this.logger.log(
        `${data.name}: ${gameIds.length} games (${added.count} new, ${removed.count} removed)`,
      );
    }
  }
}
