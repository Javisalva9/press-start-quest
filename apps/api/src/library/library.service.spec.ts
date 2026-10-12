import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { LibraryService } from './library.service.js';

describe('LibraryService.setLength', () => {
  const prisma = {
    userGame: { findFirst: vi.fn() },
    game: { update: vi.fn() },
  };
  let service: LibraryService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [LibraryService, { provide: PrismaService, useValue: prisma }],
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
