import { JobsController } from './jobs.controller.js';

describe('JobsController.daily', () => {
  const prisma = { user: { findMany: vi.fn() } };
  const sync = { runAndWait: vi.fn() };
  const controller = new JobsController(prisma as never, sync as never);

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
    });
    expect(sync.runAndWait.mock.calls).toEqual([['u1'], ['u2'], ['u3']]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sources: { some: { platform: 'STEAM' } } },
      }),
    );
  });
});
