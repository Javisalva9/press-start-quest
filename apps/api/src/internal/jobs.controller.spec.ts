import { JobsController } from './jobs.controller.js';

describe('JobsController.daily', () => {
  const prisma = { user: { findMany: vi.fn() } };
  const sync = { runAndWait: vi.fn() };
  const prices = { enabled: false, refresh: vi.fn() };
  const freeGames = { refresh: vi.fn() };
  const controller = new JobsController(
    prisma as never,
    sync as never,
    prices as never,
    freeGames as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prices.enabled = false;
    freeGames.refresh.mockResolvedValue({ freeGames: 2 });
  });

  it('syncs every Steam user one after another and sums it up', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1' },
      { id: 'u2' },
      { id: 'u3' },
    ]);
    sync.runAndWait
      .mockResolvedValueOnce({ status: 'DONE' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'FAILED' });

    await expect(controller.daily()).resolves.toEqual({
      users: 3,
      synced: 1,
      skipped: 1,
      failed: 1,
      prices: null,
      freeGames: { freeGames: 2 },
    });
    expect(sync.runAndWait.mock.calls).toEqual([['u1'], ['u2'], ['u3']]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sources: { some: { platform: 'STEAM' } } },
      }),
    );
  });

  it('checks the prices after the syncs, when there is a key', async () => {
    prices.enabled = true;
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    sync.runAndWait.mockResolvedValue({ status: 'DONE' });
    prices.refresh.mockResolvedValue({ wanted: 3 });

    await expect(controller.daily()).resolves.toMatchObject({
      synced: 1,
      prices: { wanted: 3 },
    });
    expect(sync.runAndWait.mock.invocationCallOrder[0]).toBeLessThan(
      prices.refresh.mock.invocationCallOrder[0]!,
    );
  });

  it("doesn't fail the night when the prices do", async () => {
    prices.enabled = true;
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    sync.runAndWait.mockResolvedValue({ status: 'DONE' });
    prices.refresh.mockRejectedValue(new TypeError('fetch failed'));

    await expect(controller.daily()).resolves.toMatchObject({
      synced: 1,
      prices: { error: 'TypeError' },
    });
  });

  it("doesn't fail the night when the free games do", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    freeGames.refresh.mockRejectedValue(new SyntaxError('bad json'));
    await expect(controller.daily()).resolves.toMatchObject({
      freeGames: { error: 'SyntaxError' },
    });
  });
});
