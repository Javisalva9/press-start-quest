import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { IgdbApi } from '../providers/igdb/igdb-api.js';
import {
  SteamStoreApi,
  type SteamAppDetails,
} from '../providers/steam/steam-store-api.js';
import { BATCH_SIZE, CatalogEnricher } from './catalog-enricher.js';

const catalogGame = (n: number) => ({
  id: `g${n}`,
  title: `Game ${n}`,
  steamAppId: 1000 + n,
  igdbId: null,
  kind: 'GAME',
  ttbSource: null,
});

const storeDetails = (appId: number): SteamAppDetails => ({
  appId,
  type: 'game',
  name: `Game ${appId}`,
  summary: null,
  headerImageUrl: null,
  developer: null,
  genres: ['Action'],
  categories: [],
  metacritic: null,
  releaseDate: null,
  fullGameAppId: null,
});

describe('CatalogEnricher', () => {
  const prisma = {
    game: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    tag: { createMany: vi.fn(), findMany: vi.fn() },
    gameTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const store = { getAppDetails: vi.fn() };
  const igdb = {
    findBySteamAppIds: vi.fn(),
    findByName: vi.fn(),
    getGames: vi.fn(),
    getTimesToBeat: vi.fn(),
  };
  let enricher: CatalogEnricher;
  const noProgress = () => Promise.resolve();

  /** The game updates of each saved batch, in order. */
  const savedBatches = () =>
    prisma.$transaction.mock.calls
      .map((call) => call[0] as Array<{ update?: string } | undefined>)
      .filter((ops) => ops.every((op) => op?.update))
      .map((ops) => ops.map((op) => op?.update));

  /** The data written for one game. */
  const dataFor = (id: string) =>
    prisma.game.update.mock.calls
      .map((call) => call[0] as { where: { id: string }; data: object })
      .find(({ where }) => where.id === id)?.data;

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.game.findMany.mockResolvedValue([]);
    prisma.game.update.mockImplementation(({ where }) => ({
      update: where.id,
    }));
    prisma.$transaction.mockImplementation((ops: unknown[]) =>
      Promise.resolve(ops),
    );
    prisma.tag.findMany.mockResolvedValue([]);
    store.getAppDetails.mockImplementation((appId: number) =>
      Promise.resolve(storeDetails(appId)),
    );
    igdb.findBySteamAppIds.mockResolvedValue(new Map());
    igdb.findByName.mockResolvedValue(null);
    igdb.getGames.mockResolvedValue([]);
    igdb.getTimesToBeat.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogEnricher,
        { provide: PrismaService, useValue: prisma },
        { provide: SteamStoreApi, useValue: store },
        { provide: IgdbApi, useValue: igdb },
      ],
    }).compile();
    enricher = moduleRef.get(CatalogEnricher);
  });

  const withCandidates = (count: number) => {
    const games = Array.from({ length: count }, (_, i) => catalogGame(i + 1));
    prisma.game.findMany.mockResolvedValueOnce(games);
    return games;
  };

  it(`saves the catalog in batches of ${BATCH_SIZE}`, async () => {
    withCandidates(23);

    await expect(enricher.enrich('u1', noProgress)).resolves.toEqual({
      enriched: 23,
    });

    expect(savedBatches().map((batch) => batch.length)).toEqual([10, 10, 3]);
    expect(dataFor('g1')).toMatchObject({ metadataAt: expect.any(Date) });
  });

  it('keeps the batches already saved when the sync stops halfway', async () => {
    withCandidates(23);
    // The job is closed while the second batch is being fetched.
    let calls = 0;
    const onProgress = () => {
      calls += 1;
      return calls > 13
        ? Promise.reject(new Error('stopped'))
        : Promise.resolve();
    };

    await expect(enricher.enrich('u1', onProgress)).rejects.toThrow('stopped');

    // The first batch is in the database: the next sync won't ask for it.
    expect(savedBatches()).toEqual([
      ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'],
    ]);
  });

  it('reports progress that only moves forward and ends at 1', async () => {
    withCandidates(12);
    const values: number[] = [];

    await enricher.enrich('u1', (fraction) => {
      values.push(fraction);
      return Promise.resolve();
    });

    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values.at(-1)).toBeCloseTo(1);
  });

  it('leaves out of the batch a game whose store request failed', async () => {
    withCandidates(3);
    store.getAppDetails.mockImplementation((appId: number) =>
      appId === 1002
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve(storeDetails(appId)),
    );

    await expect(enricher.enrich('u1', noProgress)).resolves.toEqual({
      enriched: 2,
    });
    expect(savedBatches()).toEqual([['g1', 'g3']]);
  });

  it('stops asking IGDB for the rest of the sync once it fails', async () => {
    withCandidates(15);
    igdb.findBySteamAppIds.mockRejectedValue(new Error('IGDB down'));

    await enricher.enrich('u1', noProgress);

    expect(igdb.findBySteamAppIds).toHaveBeenCalledTimes(1);
    // Store data is saved, but the games stay due so IGDB is tried again.
    expect(savedBatches().map((batch) => batch.length)).toEqual([10, 5]);
    expect(dataFor('g12')).toMatchObject({ metadataAt: undefined });
  });

  it('does nothing when every game is up to date', async () => {
    await expect(enricher.enrich('u1', noProgress)).resolves.toEqual({
      enriched: 0,
    });
    expect(store.getAppDetails).not.toHaveBeenCalled();
  });
});
