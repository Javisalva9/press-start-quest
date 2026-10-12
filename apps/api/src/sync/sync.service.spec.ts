import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { LibraryImporter } from './library-importer.js';
import { SyncError } from './sync-error.js';
import { SyncService } from './sync.service.js';

const NOW = new Date('2026-10-12T20:00:00Z');
const job = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  userId: 'u1',
  status: 'QUEUED',
  progress: 0,
  stats: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: NOW,
  ...overrides,
});

describe('SyncService', () => {
  const prisma = {
    syncJob: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const importer = { importSteam: vi.fn() };
  let service: SyncService;

  /** Lets the background job run until it settles. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.syncJob.update.mockResolvedValue(job());
    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: LibraryImporter, useValue: importer },
      ],
    }).compile();
    service = moduleRef.get(SyncService);
  });

  it('creates a job, answers at once and finishes it in the background', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    const stats = {
      gamesFound: 3,
      gamesAdded: 3,
      playtimeUpdated: 0,
      notGames: 0,
    };
    importer.importSteam.mockResolvedValue(stats);

    const started = await service.start('u1');
    expect(started).toMatchObject({ id: 'job-1', status: 'QUEUED' });

    await flush();
    expect(prisma.syncJob.update).toHaveBeenLastCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'DONE', progress: 100, stats }),
    });
  });

  it('saves the error code when the sync fails for a known reason', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    importer.importSteam.mockRejectedValue(
      new SyncError('STEAM_LIBRARY_PRIVATE'),
    );

    await service.start('u1');
    await flush();

    expect(prisma.syncJob.update).toHaveBeenLastCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'STEAM_LIBRARY_PRIVATE',
      }),
    });
  });

  it('uses a generic code for unexpected errors', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    importer.importSteam.mockRejectedValue(new Error('boom'));

    await service.start('u1');
    await flush();

    expect(prisma.syncJob.update).toHaveBeenLastCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ error: 'SYNC_FAILED' }),
    });
  });

  it('returns the running job instead of starting another one', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    importer.importSteam.mockReturnValue(new Promise(() => undefined));
    await service.start('u1');

    prisma.syncJob.findFirst.mockResolvedValue(job({ status: 'RUNNING' }));
    const again = await service.start('u1');

    expect(again.id).toBe('job-1');
    expect(prisma.syncJob.create).toHaveBeenCalledTimes(1);
  });

  it('marks as interrupted a job left running by a previous process', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(job({ status: 'RUNNING' }));
    prisma.syncJob.findUniqueOrThrow.mockResolvedValue(
      job({ status: 'FAILED', error: 'SYNC_INTERRUPTED', finishedAt: NOW }),
    );

    await expect(service.getJob('u1', 'job-1')).resolves.toMatchObject({
      status: 'FAILED',
      error: 'SYNC_INTERRUPTED',
    });
    expect(prisma.syncJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: { in: ['QUEUED', 'RUNNING'] } },
      data: expect.objectContaining({ error: 'SYNC_INTERRUPTED' }),
    });
  });

  it('answers 404 for a job of another user or that does not exist', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    await expect(service.getJob('u1', 'nope')).rejects.toMatchObject({
      status: 404,
    });
  });
});
