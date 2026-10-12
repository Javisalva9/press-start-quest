import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const prisma = {
    source: { findUnique: vi.fn() },
    user: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  };
  let service: UsersService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('findOrCreateBySteamId', () => {
    const user = { id: 'u1', displayName: 'Javi', locale: 'es' };

    it('creates the user and its Steam source on first sign-in', async () => {
      prisma.source.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      await service.findOrCreateBySteamId('76561197960287930', {
        displayName: 'Javi',
        language: 'es',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          displayName: 'Javi',
          locale: 'es',
          sources: {
            create: { platform: 'STEAM', externalId: '76561197960287930' },
          },
        },
      });
    });

    it('falls back to the SteamID when there is no Steam name', async () => {
      prisma.source.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      await service.findOrCreateBySteamId('76561197960287930', {
        displayName: null,
        language: 'en',
      });

      expect(prisma.user.create.mock.calls[0][0].data.displayName).toBe(
        '76561197960287930',
      );
    });

    it('returns the existing user without writing if nothing changed', async () => {
      prisma.source.findUnique.mockResolvedValue({ user });

      const result = await service.findOrCreateBySteamId('76561197960287930', {
        displayName: 'Javi',
        language: 'en',
      });

      expect(result).toBe(user);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates the name when it changed on Steam', async () => {
      prisma.source.findUnique.mockResolvedValue({ user });

      await service.findOrCreateBySteamId('76561197960287930', {
        displayName: 'Javi 2',
        language: 'en',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { displayName: 'Javi 2' },
      });
    });
  });

  describe('getMe', () => {
    it('returns the profile with the SteamID', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        displayName: 'Javi',
        locale: 'es',
        sources: [
          {
            externalId: '76561197960287930',
            lastSyncAt: new Date('2026-10-12T22:00:00Z'),
          },
        ],
      });

      await expect(service.getMe('u1')).resolves.toEqual({
        id: 'u1',
        displayName: 'Javi',
        locale: 'es',
        steamId: '76561197960287930',
        lastSyncAt: '2026-10-12T22:00:00.000Z',
      });
    });

    it('rejects a token whose user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('gone')).rejects.toMatchObject({
        status: 401,
      });
    });
  });
});
