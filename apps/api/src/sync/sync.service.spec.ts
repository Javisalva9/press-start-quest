import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasteProfileService } from '../taste/taste-profile.service.js';
import { AchievementsImporter } from './achievements-importer.js';
import { AutoStatusUpdater } from './auto-status-updater.js';
import { CatalogEnricher } from './catalog-enricher.js';
import { CompletionDetector } from './completion-detector.js';
import { FinaleRuleUpdater } from './finale-rule-updater.js';
import { GameTypeUpdater } from './game-type-updater.js';
import { LibraryImporter } from './library-importer.js';
import { ServerStatusUpdater } from './server-status-updater.js';
import { SnapshotRecorder } from './snapshot-recorder.js';
import { WishlistImporter } from './wishlist-importer.js';
import { SyncError } from './sync-error.js';
import { HEARTBEAT_MS, STALE_AFTER_MS, SyncService } from './sync.service.js';

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
  updatedAt: NOW,
  ...overrides,
});
/** A job whose last write is older than the safety net allows. */
const silentSince = () => new Date(Date.now() - STALE_AFTER_MS - 1000);

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
  const enricher = { enrich: vi.fn(), coverage: vi.fn() };
  const wishlist = { importSteam: vi.fn() };
  const achievements = { importSteam: vi.fn() };
  const gameTypes = { update: vi.fn() };
  const serverStatus = { update: vi.fn() };
  const finaleRules = { update: vi.fn() };
  const completions = { update: vi.fn() };
  const statuses = { update: vi.fn() };
  const snapshots = { record: vi.fn() };
  const taste = { refresh: vi.fn() };
  let service: SyncService;

  /** Lets the background job run until it settles. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** The arguments of every updateMany call, in order. */
  const updates = () =>
    prisma.syncJob.updateMany.mock.calls.map(
      (call) => call[0] as { where: unknown; data: Record<string, unknown> },
    );

  const succeedingSync = () => {
    importer.importSteam.mockImplementation(
      async (_userId: string, onProgress: (value: number) => Promise<void>) => {
        await onProgress(50);
        return {
          stats: {
            gamesFound: 3,
            gamesAdded: 3,
            playtimeUpdated: 0,
            notGames: 0,
          },
          touchedUserGameIds: ['ug1'],
        };
      },
    );
    wishlist.importSteam.mockResolvedValue({ wishlistItems: 4 });
    achievements.importSteam.mockResolvedValue({ achievementsRead: 2 });
    enricher.enrich.mockResolvedValue({ enriched: 3 });
    enricher.coverage.mockResolvedValue({ notGames: 1, withoutDuration: 2 });
    gameTypes.update.mockResolvedValue(0);
    serverStatus.update.mockResolvedValue(0);
    finaleRules.update.mockResolvedValue(0);
    completions.update.mockResolvedValue(0);
    statuses.update.mockResolvedValue(0);
    snapshots.record.mockResolvedValue(0);
    taste.refresh.mockResolvedValue(0);
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.syncJob.updateMany.mockResolvedValue({ count: 1 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: LibraryImporter, useValue: importer },
        { provide: CatalogEnricher, useValue: enricher },
        { provide: WishlistImporter, useValue: wishlist },
        { provide: AchievementsImporter, useValue: achievements },
        { provide: GameTypeUpdater, useValue: gameTypes },
        { provide: ServerStatusUpdater, useValue: serverStatus },
        { provide: FinaleRuleUpdater, useValue: finaleRules },
        { provide: CompletionDetector, useValue: completions },
        { provide: AutoStatusUpdater, useValue: statuses },
        { provide: SnapshotRecorder, useValue: snapshots },
        { provide: TasteProfileService, useValue: taste },
      ],
    }).compile();
    service = moduleRef.get(SyncService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a job, answers at once and finishes it in the background', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    succeedingSync();

    const started = await service.start('u1');
    expect(started).toMatchObject({ id: 'job-1', status: 'QUEUED' });

    await flush();
    // Achievements are only refreshed where the import saw changes.
    // Classified after the catalog is enriched.
    expect(gameTypes.update).toHaveBeenCalledWith('u1');
    expect(serverStatus.update).toHaveBeenCalledWith('u1');
    // After the achievements: the detector needs them.
    expect(completions.update).toHaveBeenCalledWith('u1');
    expect(statuses.update).toHaveBeenCalledWith('u1');
    // After the statuses, which the taste follows.
    expect(taste.refresh).toHaveBeenCalledWith('u1');
    expect(taste.refresh.mock.invocationCallOrder[0]).toBeGreaterThan(
      statuses.update.mock.invocationCallOrder[0]!,
    );
    // Today's playtime photo of what changed.
    expect(snapshots.record).toHaveBeenCalledWith(
      'u1',
      ['ug1'],
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(achievements.importSteam).toHaveBeenCalledWith(
      'u1',
      ['ug1'],
      expect.any(Function),
    );
    expect(prisma.syncJob.updateMany).toHaveBeenLastCalledWith({
      // Only a job that is still running can be finished.
      where: { id: 'job-1', status: 'RUNNING' },
      data: expect.objectContaining({
        status: 'DONE',
        progress: 100,
        // The coverage, counted after enriching, replaces the importer's count.
        stats: {
          gamesFound: 3,
          gamesAdded: 3,
          playtimeUpdated: 0,
          notGames: 1,
          enriched: 3,
          withoutDuration: 2,
          wishlistItems: 4,
          achievementsRead: 2,
        },
      }),
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

    expect(prisma.syncJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'job-1', status: { in: ['QUEUED', 'RUNNING'] } },
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

    expect(prisma.syncJob.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({ error: 'SYNC_FAILED' }),
    });
  });

  it('returns an active job that is still writing, even if another process runs it', async () => {
    // Not started by this service: during a deploy, the old instance runs it.
    prisma.syncJob.findFirst.mockResolvedValue(
      job({ status: 'RUNNING', updatedAt: new Date() }),
    );

    const again = await service.start('u1');

    expect(again).toMatchObject({ id: 'job-1', status: 'RUNNING' });
    expect(prisma.syncJob.create).not.toHaveBeenCalled();
    expect(prisma.syncJob.updateMany).not.toHaveBeenCalled();
  });

  it('closes a silent job and starts a new one', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(
      job({ status: 'RUNNING', updatedAt: silentSince() }),
    );
    prisma.syncJob.findUniqueOrThrow.mockResolvedValue(
      job({ status: 'FAILED', error: 'SYNC_INTERRUPTED' }),
    );
    prisma.syncJob.create.mockResolvedValue(job({ id: 'job-2' }));
    importer.importSteam.mockReturnValue(new Promise(() => undefined));

    const started = await service.start('u1');

    expect(started.id).toBe('job-2');
    expect(updates()[0]).toEqual({
      // Conditional: if it wrote again a moment ago, it's left alone.
      where: {
        id: 'job-1',
        status: { in: ['QUEUED', 'RUNNING'] },
        updatedAt: { lt: expect.any(Date) },
      },
      data: expect.objectContaining({ error: 'SYNC_INTERRUPTED' }),
    });
  });

  it('returns the job another request created at the same time', async () => {
    prisma.syncJob.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(job({ id: 'job-other', updatedAt: new Date() }));
    prisma.syncJob.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.start('u1')).resolves.toMatchObject({
      id: 'job-other',
    });
  });

  it('rethrows other database errors when creating a job', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockRejectedValue(new Error('connection lost'));

    await expect(service.start('u1')).rejects.toThrow('connection lost');
  });

  it('leaves an active job alone while it keeps writing', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(
      job({ status: 'RUNNING', progress: 40, updatedAt: new Date() }),
    );

    await expect(service.getJob('u1', 'job-1')).resolves.toMatchObject({
      status: 'RUNNING',
      progress: 40,
    });
    expect(prisma.syncJob.updateMany).not.toHaveBeenCalled();
  });

  it('marks as interrupted a job that stopped writing', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(
      job({ status: 'RUNNING', updatedAt: silentSince() }),
    );
    prisma.syncJob.findUniqueOrThrow.mockResolvedValue(
      job({ status: 'FAILED', error: 'SYNC_INTERRUPTED', finishedAt: NOW }),
    );

    await expect(service.getJob('u1', 'job-1')).resolves.toMatchObject({
      status: 'FAILED',
      error: 'SYNC_INTERRUPTED',
    });
  });

  it('answers 404 for a job of another user or that does not exist', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    await expect(service.getJob('u1', 'nope')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('writes a heartbeat while a job runs, even if its progress does not move', async () => {
    vi.useFakeTimers();
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    importer.importSteam.mockReturnValue(new Promise(() => undefined));

    await service.start('u1');
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(prisma.syncJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'job-1', status: 'RUNNING' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('stops a job that was declared interrupted elsewhere', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    succeedingSync();
    // Starting works; the first progress write finds the job closed.
    prisma.syncJob.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });

    await service.start('u1');
    await flush();

    expect(wishlist.importSteam).not.toHaveBeenCalled();
    // Nothing is written over the interruption.
    expect(updates().some(({ data }) => data.status === 'DONE')).toBe(false);
    expect(updates().some(({ data }) => data.status === 'FAILED')).toBe(false);
  });

  it('marks its own jobs as interrupted when the app shuts down', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    importer.importSteam.mockReturnValue(new Promise(() => undefined));
    await service.start('u1');

    await service.beforeApplicationShutdown('SIGTERM');

    expect(prisma.syncJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: ['job-1'] }, status: { in: ['QUEUED', 'RUNNING'] } },
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'SYNC_INTERRUPTED',
      }),
    });
  });

  it('does not touch the database on shutdown when nothing runs', async () => {
    await service.beforeApplicationShutdown('SIGTERM');
    expect(prisma.syncJob.updateMany).not.toHaveBeenCalled();
  });

  it('runs a sync and waits for it, for the nightly job', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(job());
    succeedingSync();
    prisma.syncJob.findUniqueOrThrow.mockResolvedValue(
      job({ status: 'DONE', progress: 100 }),
    );

    await expect(service.runAndWait('u1')).resolves.toMatchObject({
      status: 'DONE',
    });
    // Waited: the sync had already finished.
    expect(achievements.importSteam).toHaveBeenCalled();
  });

  it('does not wait for a sync started elsewhere', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(
      job({ status: 'RUNNING', updatedAt: new Date() }),
    );
    await expect(service.runAndWait('u1')).resolves.toBeNull();
    expect(prisma.syncJob.create).not.toHaveBeenCalled();
  });
});
