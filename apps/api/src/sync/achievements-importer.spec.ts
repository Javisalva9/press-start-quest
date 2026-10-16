import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { SteamLibraryProvider } from '../providers/steam/steam-library.provider.js';
import {
  AchievementsImporter,
  countAchievements,
} from './achievements-importer.js';

describe('countAchievements', () => {
  it('counts unlocked and total achievements', () => {
    expect(
      countAchievements([
        { id: 'a', name: 'A', description: '', unlockedAt: new Date() },
        { id: 'b', name: 'B', description: '', unlockedAt: null },
        { id: 'c', name: 'C', description: '', unlockedAt: new Date() },
      ]),
    ).toEqual({ achievementsUnlocked: 2, achievementsTotal: 3 });
  });

  it('saves 0 / 0 for a game without achievements, so it is not asked again', () => {
    expect(countAchievements(null)).toEqual({
      achievementsUnlocked: 0,
      achievementsTotal: 0,
    });
  });
});

describe('AchievementsImporter', () => {
  const prisma = {
    userGame: { findMany: vi.fn(), update: vi.fn() },
    achievement: { createMany: vi.fn(), findMany: vi.fn() },
    userAchievement: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const steam = { getAchievements: vi.fn() };
  let importer: AchievementsImporter;

  const entry = (id: string, gameId: string, appId: string) => ({
    id,
    gameId,
    ownerships: [{ externalAppId: appId, source: { externalId: 'steam-1' } }],
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.userGame.update.mockImplementation((args) => ({ update: args }));
    prisma.userAchievement.deleteMany.mockImplementation((args) => ({
      deleteMany: args,
    }));
    prisma.userAchievement.createMany.mockImplementation((args) => ({
      createMany: args,
    }));
    prisma.$transaction.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AchievementsImporter,
        { provide: PrismaService, useValue: prisma },
        { provide: SteamLibraryProvider, useValue: steam },
      ],
    }).compile();
    importer = moduleRef.get(AchievementsImporter);
  });

  /** The operations sent in the final transaction. */
  const transaction = () =>
    prisma.$transaction.mock.calls[0]?.[0] as Array<Record<string, unknown>>;

  it('saves the catalog and links only the unlocked achievements', async () => {
    prisma.userGame.findMany.mockResolvedValue([entry('ug1', 'g1', '10')]);
    steam.getAchievements.mockResolvedValue([
      {
        id: 'START',
        name: 'First steps',
        description: 'Start',
        unlockedAt: new Date('2026-01-01'),
      },
      { id: 'END', name: 'Credits', description: 'Finish', unlockedAt: null },
    ]);
    prisma.achievement.findMany.mockResolvedValue([
      { id: 'a1', gameId: 'g1', externalId: 'START' },
      { id: 'a2', gameId: 'g1', externalId: 'END' },
    ]);

    await expect(
      importer.importSteam('u1', [], () => Promise.resolve()),
    ).resolves.toEqual({ achievementsRead: 1 });

    // Locked ones too: the catalog is the game's full list.
    expect(prisma.achievement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ gameId: 'g1', externalId: 'START' }),
        expect.objectContaining({ gameId: 'g1', externalId: 'END' }),
      ],
      skipDuplicates: true,
    });
    expect(transaction()).toEqual([
      {
        update: {
          where: { id: 'ug1' },
          data: { achievementsUnlocked: 1, achievementsTotal: 2 },
        },
      },
      // What the game had is replaced by what was read now.
      {
        deleteMany: {
          where: {
            userGameId: { in: ['ug1'] },
            achievement: { platform: 'STEAM' },
          },
        },
      },
      {
        createMany: {
          data: [
            {
              userGameId: 'ug1',
              achievementId: 'a1',
              unlockedAt: new Date('2026-01-01'),
            },
          ],
        },
      },
    ]);
  });

  it('saves 0 / 0 and clears the unlocks of a game without achievements', async () => {
    prisma.userGame.findMany.mockResolvedValue([entry('ug1', 'g1', '10')]);
    steam.getAchievements.mockResolvedValue(null);
    prisma.achievement.findMany.mockResolvedValue([]);

    await importer.importSteam('u1', [], () => Promise.resolve());

    expect(prisma.achievement.createMany).not.toHaveBeenCalled();
    expect(transaction()).toEqual([
      {
        update: {
          where: { id: 'ug1' },
          data: { achievementsUnlocked: 0, achievementsTotal: 0 },
        },
      },
      expect.objectContaining({ deleteMany: expect.anything() }),
    ]);
  });

  it('leaves a game as it was when its request fails', async () => {
    prisma.userGame.findMany.mockResolvedValue([
      entry('ug1', 'g1', '10'),
      entry('ug2', 'g2', '20'),
    ]);
    steam.getAchievements.mockImplementation((_steamId, appId: string) =>
      appId === '10'
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve(null),
    );
    prisma.achievement.findMany.mockResolvedValue([]);

    await expect(
      importer.importSteam('u1', [], () => Promise.resolve()),
    ).resolves.toEqual({ achievementsRead: 1 });
    expect(JSON.stringify(transaction())).not.toContain('ug1');
  });

  it('reads again games counted before names were saved, even with none unlocked', async () => {
    prisma.userGame.findMany.mockResolvedValue([]);

    await importer.importSteam('u1', ['ug9'], () => Promise.resolve());

    expect(prisma.userGame.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { achievementsTotal: null },
            { id: { in: ['ug9'] } },
            {
              achievementsTotal: { gt: 0 },
              game: { achievements: { none: { platform: 'STEAM' } } },
            },
            { achievementsUnlocked: { gt: 0 }, achievements: { none: {} } },
          ],
        }),
      }),
    );
  });

  it('does not touch the database when there is nothing to read', async () => {
    prisma.userGame.findMany.mockResolvedValue([]);

    await importer.importSteam('u1', [], () => Promise.resolve());

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
