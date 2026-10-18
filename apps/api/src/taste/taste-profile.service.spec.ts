import { TasteProfileService } from './taste-profile.service.js';

describe('TasteProfileService', () => {
  const prisma = {
    userGame: { findMany: vi.fn() },
    tasteScore: { deleteMany: vi.fn(), findMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  const service = new TasteProfileService(prisma as never);

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.tasteScore.deleteMany.mockReturnValue('delete');
    prisma.$executeRaw.mockReturnValue('insert');
    prisma.$transaction.mockResolvedValue([{ count: 3 }, 7]);
  });

  describe('refresh', () => {
    it('reads only the owned games of the library', async () => {
      prisma.userGame.findMany.mockResolvedValue([]);
      await service.refresh('u1');
      expect(prisma.userGame.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'u1',
            owned: true,
            hidden: false,
            game: { kind: 'GAME' },
          },
        }),
      );
    });

    it('replaces the profile in one transaction, sending only the games that weigh', async () => {
      prisma.userGame.findMany.mockResolvedValue([
        {
          gameId: 'done',
          status: 'COMPLETED',
          playtimeMin: 600,
          // 5 stars, stored as half stars.
          personalRating: 10,
        },
        {
          gameId: 'dropped',
          status: 'ABANDONED',
          playtimeMin: 600,
          personalRating: null,
        },
        {
          gameId: 'untouched',
          status: 'BACKLOG',
          playtimeMin: 0,
          personalRating: null,
        },
      ]);

      await expect(service.refresh('u1')).resolves.toBe(7);

      expect(prisma.tasteScore.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(['delete', 'insert']);
      // A tagged template: the SQL pieces and, apart, the values.
      const [sql, ...values] = prisma.$executeRaw.mock.calls[0];
      expect(sql.join('?')).toContain('INSERT INTO "taste_scores"');
      expect(sql.join('?')).toContain('ON CONFLICT ("userId", "tagId")');
      expect(values).toEqual([
        ['done', 'dropped'],
        [1.5, -0.3],
        'u1',
        ['GENRE', 'THEME', 'MODE', 'PERSPECTIVE'],
        'u1',
      ]);
    });

    it('never fails its caller: it logs and answers null', async () => {
      prisma.userGame.findMany.mockResolvedValue([]);
      prisma.$transaction.mockRejectedValue(new Error('connection lost'));
      await expect(service.refresh('u1')).resolves.toBeNull();
    });
  });

  describe('profile', () => {
    it('groups the tags by kind, favourites first, with the latest date', async () => {
      prisma.tasteScore.findMany.mockResolvedValue([
        {
          score: 4.256,
          updatedAt: new Date('2026-10-17T10:00:00Z'),
          tag: { name: 'Role-playing (RPG)', kind: 'GENRE' },
        },
        {
          score: 2.5,
          updatedAt: new Date('2026-10-17T11:00:00Z'),
          tag: { name: 'Fantasy', kind: 'THEME' },
        },
        {
          score: -0.31,
          updatedAt: new Date('2026-10-17T10:00:00Z'),
          tag: { name: 'Sport', kind: 'GENRE' },
        },
      ]);

      await expect(service.profile('u1')).resolves.toEqual({
        updatedAt: '2026-10-17T11:00:00.000Z',
        genres: [
          { name: 'Role-playing (RPG)', score: 4.26 },
          { name: 'Sport', score: -0.31 },
        ],
        themes: [{ name: 'Fantasy', score: 2.5 }],
        modes: [],
        perspectives: [],
      });
      expect(prisma.tasteScore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          orderBy: [{ score: 'desc' }, { tag: { name: 'asc' } }],
        }),
      );
    });

    it('is empty, with no date, before the first sync', async () => {
      prisma.tasteScore.findMany.mockResolvedValue([]);
      await expect(service.profile('u1')).resolves.toMatchObject({
        updatedAt: null,
        genres: [],
      });
    });
  });
});
