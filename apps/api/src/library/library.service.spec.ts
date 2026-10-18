import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasteProfileService } from '../taste/taste-profile.service.js';
import { LibraryService } from './library.service.js';

describe('LibraryService.setLength', () => {
  const prisma = {
    userGame: { findFirst: vi.fn() },
    game: { update: vi.fn() },
  };
  const taste = { refresh: vi.fn() };
  let service: LibraryService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LibraryService,
        { provide: PrismaService, useValue: prisma },
        { provide: TasteProfileService, useValue: taste },
      ],
    }).compile();
    service = moduleRef.get(LibraryService);
    // The game page returned afterwards is not what these tests check.
    vi.spyOn(service, 'get').mockResolvedValue({} as never);
  });

  it('saves a manual length, which syncs never overwrite', async () => {
    prisma.userGame.findFirst.mockResolvedValueOnce({ gameId: 'g1' });
    await service.setLength('u1', 'ug1', 600);
    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { ttbExtraMin: 600, ttbSource: 'manual' },
    });
  });

  it('clearing it lets the next sync bring IGDB data back', async () => {
    prisma.userGame.findFirst.mockResolvedValueOnce({ gameId: 'g1' });
    await service.setLength('u1', 'ug1', null);
    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { ttbExtraMin: null, ttbSource: null, metadataAt: null },
    });
  });

  it('answers 404 for an entry of another user', async () => {
    prisma.userGame.findFirst.mockResolvedValueOnce(null);
    await expect(service.setLength('u1', 'ug9', 600)).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.game.update).not.toHaveBeenCalled();
  });
});

describe('LibraryService.update', () => {
  const prisma = {
    userGame: { findFirst: vi.fn(), update: vi.fn() },
    ownership: { count: vi.fn(), updateMany: vi.fn() },
  };
  const taste = { refresh: vi.fn() };
  let service: LibraryService;

  const entry = (overrides: Record<string, unknown> = {}) => ({
    owned: true,
    status: 'ON_HOLD',
    statusSource: 'AUTO',
    completedAt: null,
    playtimeMin: 600,
    // Long ago: the automatic status is "on hold".
    lastPlayedAt: new Date('2025-01-01T00:00:00Z'),
    typeOverride: null,
    game: { gameType: 'COMPLETABLE' },
    ...overrides,
  });
  const saved = () => prisma.userGame.update.mock.calls[0][0].data;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LibraryService,
        { provide: PrismaService, useValue: prisma },
        { provide: TasteProfileService, useValue: taste },
      ],
    }).compile();
    service = moduleRef.get(LibraryService);
    vi.spyOn(service, 'get').mockResolvedValue({} as never);
  });

  it("saves the player's status, which syncs never touch", async () => {
    prisma.userGame.findFirst.mockResolvedValue(entry());
    await service.update('u1', 'ug1', { status: 'COMPLETED' });
    expect(saved()).toEqual({
      status: 'COMPLETED',
      statusSource: 'MANUAL',
      completedAt: expect.any(Date),
    });
  });

  it('keeps the first completion date when completed again', async () => {
    const completedAt = new Date('2026-05-01T00:00:00Z');
    prisma.userGame.findFirst.mockResolvedValue(
      entry({ status: 'COMPLETED', statusSource: 'MANUAL', completedAt }),
    );
    await service.update('u1', 'ug1', { status: 'COMPLETED' });
    expect(saved().completedAt).toBe(completedAt);
  });

  it('hands the status back to the app with null, worked out at once', async () => {
    prisma.userGame.findFirst.mockResolvedValue(
      entry({ status: 'COMPLETED', statusSource: 'MANUAL' }),
    );
    await service.update('u1', 'ug1', { status: null });
    expect(saved()).toEqual({
      status: 'ON_HOLD',
      statusSource: 'AUTO',
      completedAt: null,
    });
  });

  it('saves the type and recomputes an automatic status with it', async () => {
    prisma.userGame.findFirst.mockResolvedValue(entry());
    await service.update('u1', 'ug1', { gameType: 'ENDLESS' });
    // An endless game is never "on hold".
    expect(saved()).toMatchObject({
      typeOverride: 'ENDLESS',
      status: 'BACKLOG',
      statusSource: 'AUTO',
    });
  });

  it("leaves a player's status alone when only the type changes", async () => {
    prisma.userGame.findFirst.mockResolvedValue(
      entry({ status: 'ABANDONED', statusSource: 'MANUAL' }),
    );
    await service.update('u1', 'ug1', { gameType: 'SANDBOX' });
    expect(saved()).toEqual({ typeOverride: 'SANDBOX' });
  });

  it('dates an external game as played today when set to playing', async () => {
    prisma.userGame.findFirst.mockResolvedValue(entry());
    prisma.ownership.count.mockResolvedValue(0);
    prisma.ownership.updateMany.mockResolvedValue({ count: 1 });
    await service.update('u1', 'ug1', { status: 'PLAYING' });
    expect(prisma.ownership.updateMany).toHaveBeenCalledWith({
      where: { userGameId: 'ug1', source: { platform: 'EXTERNAL' } },
      data: { lastPlayedAt: expect.any(Date) },
    });
  });

  it('refreshes the taste profile when the status changes', async () => {
    prisma.userGame.findFirst.mockResolvedValue(entry());
    await service.update('u1', 'ug1', { status: 'COMPLETED' });
    expect(taste.refresh).toHaveBeenCalledWith('u1');
  });

  it('saves and takes back the stars, and refreshes the taste', async () => {
    prisma.userGame.findFirst.mockResolvedValue(
      entry({ status: 'COMPLETED', statusSource: 'MANUAL' }),
    );
    await service.update('u1', 'ug1', { personalRating: 3.5 });
    // Stored as half stars.
    expect(saved()).toEqual({ personalRating: 7 });
    expect(taste.refresh).toHaveBeenCalledWith('u1');

    prisma.userGame.update.mockClear();
    await service.update('u1', 'ug1', { personalRating: null });
    expect(saved()).toEqual({ personalRating: null });
  });

  it('leaves an automatic status alone when only the stars change', async () => {
    // A review answer may still be on its way: recomputing the status
    // here could undo it.
    prisma.userGame.findFirst.mockResolvedValue(entry());
    await service.update('u1', 'ug1', { personalRating: 4 });
    expect(saved()).toEqual({ personalRating: 8 });
  });

  it('refuses stars for a game that is only wishlisted', async () => {
    prisma.userGame.findFirst.mockResolvedValue(
      entry({ owned: false, status: 'WISHLIST' }),
    );
    await expect(
      service.update('u1', 'ug1', { personalRating: 4 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('saves and clears the server status', async () => {
    prisma.userGame.findFirst.mockResolvedValue(
      entry({ statusSource: 'MANUAL' }),
    );
    await service.update('u1', 'ug1', { serverStatus: 'CLOSED' });
    expect(saved()).toEqual({ serverOverride: 'CLOSED' });

    prisma.userGame.update.mockClear();
    await service.update('u1', 'ug1', { serverStatus: null });
    expect(saved()).toEqual({ serverOverride: null });
    // No status changed: nothing for the taste profile.
    expect(taste.refresh).not.toHaveBeenCalled();
  });

  it('refuses a status for a game that is only wishlisted', async () => {
    prisma.userGame.findFirst.mockResolvedValue(
      entry({ owned: false, status: 'WISHLIST' }),
    );
    await expect(
      service.update('u1', 'ug1', { status: 'COMPLETED' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.userGame.update).not.toHaveBeenCalled();
  });

  it("answers 404 for another user's entry", async () => {
    prisma.userGame.findFirst.mockResolvedValue(null);
    await expect(
      service.update('u1', 'ug9', { status: 'COMPLETED' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('LibraryService.removeFromWishlist', () => {
  const prisma = { userGame: { findFirst: vi.fn(), update: vi.fn() } };
  const service = new LibraryService(prisma as never, {} as never);

  beforeEach(() => vi.resetAllMocks());

  it('hides it instead of deleting it, so a list cannot bring it back', async () => {
    prisma.userGame.findFirst.mockResolvedValue({
      owned: false,
      status: 'WISHLIST',
    });
    await service.removeFromWishlist('u1', 'ug1');
    expect(prisma.userGame.update).toHaveBeenCalledWith({
      where: { id: 'ug1' },
      data: { hidden: true },
    });
  });

  it.each([
    [{ owned: true, status: 'BACKLOG' }, 'LIBRARY_GAME_ALREADY_OWNED'],
    [{ owned: false, status: 'DISCARDED' }, 'LIBRARY_GAME_NOT_WISHED'],
  ])('refuses %o with 409 %s', async (entry, code) => {
    prisma.userGame.findFirst.mockResolvedValue(entry);
    await expect(service.removeFromWishlist('u1', 'ug1')).rejects.toMatchObject(
      { status: 409, response: { code } },
    );
    expect(prisma.userGame.update).not.toHaveBeenCalled();
  });
});
