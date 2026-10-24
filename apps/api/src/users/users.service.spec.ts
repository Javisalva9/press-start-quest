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
        settings: {
          weights: {
            quality: 3,
            affinity: 3,
            length: 2,
            social: 1,
            momentum: 1,
          },
        },
      });
    });

    it('rejects a token whose user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('gone')).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('updateMe', () => {
    const weights = {
      quality: 5,
      affinity: 5,
      length: 0,
      social: 0,
      momentum: 2,
    };

    beforeEach(() => {
      // The profile returned afterwards is not what these tests check.
      vi.spyOn(service, 'getMe').mockResolvedValue({} as never);
    });

    const saved = () => prisma.user.update.mock.calls[0]![0].data;

    it('changes the language and leaves the settings alone', async () => {
      prisma.user.findUnique.mockResolvedValue({ settings: { weights } });
      await service.updateMe('u1', { locale: 'es' });
      expect(saved()).toEqual({ locale: 'es' });
    });

    it('saves the weights in the settings column', async () => {
      prisma.user.findUnique.mockResolvedValue({ settings: {} });
      await service.updateMe('u1', { weights });
      expect(saved()).toEqual({ settings: { weights } });
    });

    it("takes them out with null: back to the plan's", async () => {
      prisma.user.findUnique.mockResolvedValue({ settings: { weights } });
      await service.updateMe('u1', { weights: null });
      expect(saved()).toEqual({ settings: {} });
    });

    it('rejects a token whose user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMe('gone', { locale: 'es' }),
      ).rejects.toMatchObject({ status: 401 });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
