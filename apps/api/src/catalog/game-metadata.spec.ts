import type { IgdbGame } from '../providers/igdb/igdb-api.js';
import type { SteamAppDetails } from '../providers/steam/steam-store-api.js';
import { buildGameTags, buildGameUpdate } from './game-metadata.js';

const store: SteamAppDetails = {
  appId: 620,
  type: 'game',
  name: 'Portal 2',
  summary: 'Store summary.',
  headerImageUrl: 'https://cdn.example.com/header.jpg',
  developer: 'Valve',
  genres: ['Action', 'Adventure'],
  categories: ['Single-player', 'Co-op'],
  metacritic: 95,
  releaseDate: new Date('2011-04-18T00:00:00Z'),
  fullGameAppId: null,
};

const igdb: IgdbGame = {
  igdbId: 72,
  title: 'Portal 2',
  slug: 'portal-2',
  summary: 'IGDB summary.',
  releaseDate: new Date('2011-04-19T00:00:00Z'),
  rating: 94.6,
  ratingCount: 3000,
  coverUrl: 'https://images.example.com/cover.jpg',
  developer: 'Valve Corporation',
  genres: ['Puzzle', 'Shooter'],
  themes: ['Science fiction'],
  modes: ['Single player', 'Co-operative'],
  perspectives: ['First person'],
};

const timeToBeat = {
  igdbId: 72,
  mainMinutes: 510,
  extraMinutes: 720,
  completeMinutes: 1200,
};

const portal = { title: 'Portal 2', ttbSource: null };

describe('buildGameUpdate', () => {
  it('takes each field from the source that does it best', () => {
    expect(buildGameUpdate(portal, { store, igdb, timeToBeat })).toEqual({
      kind: 'GAME',
      igdbId: 72,
      coverUrl: 'https://images.example.com/cover.jpg',
      heroUrl: 'https://cdn.example.com/header.jpg',
      summary: 'Store summary.',
      developer: 'Valve',
      releaseDate: new Date('2011-04-19T00:00:00Z'),
      rating: 94.6,
      ratingCount: 3000,
      metacritic: 95,
      ttbMainMin: 510,
      ttbExtraMin: 720,
      ttbCompleteMin: 1200,
      ttbSource: 'igdb',
    });
  });

  it('leaves fields untouched when no source has them', () => {
    const update = buildGameUpdate(portal, {
      store: null,
      igdb: null,
      timeToBeat: null,
    });
    expect(update).toEqual({
      kind: 'GAME',
      igdbId: undefined,
      coverUrl: undefined,
      heroUrl: undefined,
      summary: undefined,
      developer: undefined,
      releaseDate: undefined,
      rating: undefined,
      ratingCount: undefined,
      metacritic: undefined,
    });
  });

  it('falls back to IGDB when the store has no page', () => {
    const update = buildGameUpdate(portal, { store: null, igdb, timeToBeat });
    expect(update).toMatchObject({
      summary: 'IGDB summary.',
      developer: 'Valve Corporation',
    });
  });

  it('never replaces a length typed in by the user', () => {
    const update = buildGameUpdate(
      { title: 'Portal 2', ttbSource: 'manual' },
      { store, igdb, timeToBeat },
    );
    expect(update).not.toHaveProperty('ttbExtraMin');
    expect(update).not.toHaveProperty('ttbSource');
  });

  it('reclassifies with the store type', () => {
    const update = buildGameUpdate(
      { title: 'Portal 2 - Peer Review', ttbSource: null },
      { store: { ...store, type: 'dlc' }, igdb: null, timeToBeat: null },
    );
    expect(update.kind).toBe('DLC');
  });
});

describe('buildGameTags', () => {
  it('uses IGDB genres, themes, modes and perspectives plus store categories', () => {
    expect(buildGameTags({ store, igdb, timeToBeat })).toEqual([
      { name: 'Puzzle', kind: 'GENRE' },
      { name: 'Shooter', kind: 'GENRE' },
      { name: 'Science fiction', kind: 'THEME' },
      { name: 'Single player', kind: 'MODE' },
      { name: 'Co-operative', kind: 'MODE' },
      { name: 'First person', kind: 'PERSPECTIVE' },
      { name: 'Single-player', kind: 'STORE_CATEGORY' },
      { name: 'Co-op', kind: 'STORE_CATEGORY' },
    ]);
  });

  it('falls back to store genres for games IGDB does not know', () => {
    const tags = buildGameTags({ store, igdb: null, timeToBeat: null });
    expect(tags.filter((tag) => tag.kind === 'GENRE')).toEqual([
      { name: 'Action', kind: 'GENRE' },
      { name: 'Adventure', kind: 'GENRE' },
    ]);
  });

  it('removes duplicates', () => {
    const tags = buildGameTags({
      store: null,
      igdb: { ...igdb, genres: ['Puzzle', 'Puzzle'] },
      timeToBeat: null,
    });
    expect(tags.filter((tag) => tag.name === 'Puzzle')).toHaveLength(1);
  });
});
