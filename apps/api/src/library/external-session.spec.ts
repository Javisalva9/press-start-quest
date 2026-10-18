import { markPlayedToday } from './external-session.js';

describe('markPlayedToday', () => {
  const prisma = {
    ownership: { count: vi.fn(), updateMany: vi.fn() },
    userGame: { update: vi.fn() },
  };
  const now = new Date('2026-10-18T20:00:00Z');

  beforeEach(() => vi.resetAllMocks());

  it('dates the external copies and the game as played today', async () => {
    prisma.ownership.count.mockResolvedValue(0);
    prisma.ownership.updateMany.mockResolvedValue({ count: 1 });
    await expect(markPlayedToday(prisma as never, 'ug1', now)).resolves.toBe(
      true,
    );
    expect(prisma.ownership.updateMany).toHaveBeenCalledWith({
      where: { userGameId: 'ug1', source: { platform: 'EXTERNAL' } },
      data: { lastPlayedAt: now },
    });
    expect(prisma.userGame.update).toHaveBeenCalledWith({
      where: { id: 'ug1' },
      data: { lastPlayedAt: now },
    });
  });

  it('leaves a game Steam knows alone: its sessions are real', async () => {
    prisma.ownership.count.mockResolvedValue(1);
    await expect(markPlayedToday(prisma as never, 'ug1', now)).resolves.toBe(
      false,
    );
    expect(prisma.ownership.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing for a game with no copy at all', async () => {
    prisma.ownership.count.mockResolvedValue(0);
    prisma.ownership.updateMany.mockResolvedValue({ count: 0 });
    await expect(markPlayedToday(prisma as never, 'ug1', now)).resolves.toBe(
      false,
    );
    expect(prisma.userGame.update).not.toHaveBeenCalled();
  });
});
