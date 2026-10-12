import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenError, SessionsService } from './sessions.service.js';

const NOW = new Date('2026-10-12T20:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('SessionsService', () => {
  const prisma = {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  let service: SessionsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SessionsService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('stores only the hash of the token, valid for 30 days', async () => {
      const token = await service.create('u1');

      const { data } = prisma.session.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(sha256(token));
      expect(data.tokenHash).not.toContain(token);
      expect(data.expiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY));
    });

    it('cleans up the user’s expired sessions', async () => {
      await service.create('u1');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', expiresAt: { lt: NOW } },
      });
    });
  });

  describe('rotate', () => {
    const active = {
      id: 's1',
      userId: 'u1',
      expiresAt: new Date(NOW.getTime() + DAY),
    };

    it('swaps a valid token for a new one', async () => {
      prisma.session.findUnique.mockResolvedValueOnce(active);
      prisma.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.rotate('old-token');

      expect(result.userId).toBe('u1');
      expect(result.refreshToken).not.toBe('old-token');
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', tokenHash: sha256('old-token') },
        data: {
          tokenHash: sha256(result.refreshToken),
          previousTokenHash: sha256('old-token'),
          rotatedAt: NOW,
          expiresAt: new Date(NOW.getTime() + 30 * DAY),
        },
      });
    });

    it('rejects a token that another request has just rotated', async () => {
      prisma.session.findUnique.mockResolvedValueOnce(active);
      prisma.session.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.rotate('old-token')).rejects.toThrow(
        RefreshTokenError,
      );
    });

    it('rejects and deletes an expired session', async () => {
      prisma.session.findUnique.mockResolvedValueOnce({
        ...active,
        expiresAt: new Date(NOW.getTime() - 1),
      });

      await expect(service.rotate('old-token')).rejects.toThrow(
        RefreshTokenError,
      );
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });

    it('rejects an unknown token', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.rotate('nope')).rejects.toThrow(RefreshTokenError);
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('tolerates the previous token right after a rotation (another tab)', async () => {
      prisma.session.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 's1',
          rotatedAt: new Date(NOW.getTime() - 10_000),
        });

      await expect(service.rotate('previous')).rejects.toThrow(
        RefreshTokenError,
      );
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('closes the session when an old token is reused later', async () => {
      prisma.session.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 's1',
          rotatedAt: new Date(NOW.getTime() - DAY),
        });

      await expect(service.rotate('stolen')).rejects.toThrow(RefreshTokenError);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });

  describe('revoke', () => {
    it('deletes the session by the hash of its token', async () => {
      await service.revoke('token');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('token') },
      });
    });
  });
});
