import { ConfigService } from '@nestjs/config';
import { IgdbApi, normalizeTitle } from './igdb-api.js';

const config = {
  get: (name: string) =>
    name === 'IGDB_CLIENT_ID' ? 'client-id' : 'client-secret',
} as unknown as ConfigService<never, true>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** IgdbApi always calls fetch with a URL object. */
const urlOf = (input: unknown) => input as URL;

describe('IgdbApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  /** Answers each IGDB endpoint with `answers[endpoint]`; Twitch with a token. */
  let answers: Record<string, () => Response>;
  let igdb: IgdbApi;

  const igdbCalls = () =>
    fetchMock.mock.calls.filter(([url]) => urlOf(url).host === 'api.igdb.com');
  const tokenCalls = () =>
    fetchMock.mock.calls.filter(([url]) => urlOf(url).host === 'id.twitch.tv');

  beforeEach(() => {
    fetchMock.mockReset();
    answers = {};
    fetchMock.mockImplementation(async (input) => {
      const url = urlOf(input);
      if (url.host === 'id.twitch.tv') {
        return json({ access_token: 'token-1', expires_in: 5_000_000 });
      }
      const endpoint = url.pathname.replace('/v4/', '');
      return answers[endpoint]?.() ?? json([]);
    });
    vi.stubGlobal('fetch', fetchMock);
    igdb = new IgdbApi(config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds IGDB ids from Steam appids', async () => {
    answers.external_games = () =>
      json([
        { game: 72, uid: '620' },
        { game: 71, uid: '400' },
      ]);

    const matches = await igdb.findBySteamAppIds([620, 400, 999]);

    expect(matches).toEqual(
      new Map([
        [620, 72],
        [400, 71],
      ]),
    );
    const [, init] = igdbCalls()[0];
    expect(init?.body).toBe(
      'fields game,uid; where external_game_source = 1 & uid = ("620","400","999"); limit 500;',
    );
    expect(init?.headers).toMatchObject({
      'Client-ID': 'client-id',
      Authorization: 'Bearer token-1',
    });
  });

  it('maps game details: cover, rating, developer and tags', async () => {
    answers.games = () =>
      json([
        {
          id: 72,
          name: 'Portal 2',
          slug: 'portal-2',
          summary: 'Sequel.',
          first_release_date: 1_303_171_200,
          total_rating: 94.567,
          total_rating_count: 3000,
          cover: { image_id: 'co1rs4' },
          genres: [{ name: 'Puzzle' }, { name: 'Shooter' }],
          themes: [{ name: 'Science fiction' }],
          game_modes: [{ name: 'Single player' }],
          player_perspectives: [{ name: 'First person' }],
          involved_companies: [
            { developer: false, company: { name: 'Electronic Arts' } },
            { developer: true, company: { name: 'Valve' } },
          ],
        },
      ]);

    await expect(igdb.getGames([72])).resolves.toEqual([
      {
        igdbId: 72,
        title: 'Portal 2',
        slug: 'portal-2',
        summary: 'Sequel.',
        releaseDate: new Date(1_303_171_200_000),
        rating: 94.6,
        ratingCount: 3000,
        coverUrl:
          'https://images.igdb.com/igdb/image/upload/t_cover_big/co1rs4.jpg',
        developer: 'Valve',
        genres: ['Puzzle', 'Shooter'],
        themes: ['Science fiction'],
        modes: ['Single player'],
        perspectives: ['First person'],
      },
    ]);
  });

  it('turns lengths from seconds into minutes', async () => {
    answers.game_time_to_beats = () =>
      json([
        { game_id: 72, hastily: 30_600, normally: 43_200, completely: 72_000 },
        { game_id: 71, normally: 14_400 },
      ]);

    await expect(igdb.getTimesToBeat([72, 71])).resolves.toEqual([
      {
        igdbId: 72,
        mainMinutes: 510,
        extraMinutes: 720,
        completeMinutes: 1200,
      },
      {
        igdbId: 71,
        mainMinutes: null,
        extraMinutes: 240,
        completeMinutes: null,
      },
    ]);
  });

  it('searches PC games, escaping quotes', async () => {
    answers.games = () => json([]);
    await igdb.searchPcGames('Say "hi"');
    expect(igdbCalls()[0][1]?.body).toBe(
      'search "Say \\"hi\\""; fields name,first_release_date,cover.image_id; where platforms = (6); limit 10;',
    );
  });

  it('finds a game by its slug, or null', async () => {
    answers.games = () =>
      json([
        { id: 7, name: 'Half-Life: Alyx', first_release_date: 1584921600 },
      ]);
    await expect(igdb.findBySlug('half-life-alyx')).resolves.toMatchObject({
      igdbId: 7,
      title: 'Half-Life: Alyx',
      releaseYear: 2020,
    });
    expect(igdbCalls()[0][1]?.body).toBe(
      'fields name,first_release_date,cover.image_id; where slug = "half-life-alyx"; limit 1;',
    );

    answers.games = () => json([]);
    await expect(igdb.findBySlug('nope')).resolves.toBeNull();
  });

  describe('findByName', () => {
    it('accepts only an exact match once normalized', async () => {
      answers.games = () =>
        json([
          { id: 1, name: 'DOOM Eternal' },
          { id: 2, name: 'Doom' },
        ]);
      await expect(igdb.findByName('DOOM®')).resolves.toBe(2);
    });

    it('returns null instead of guessing', async () => {
      answers.games = () => json([{ id: 1, name: 'DOOM Eternal' }]);
      await expect(igdb.findByName('DOOM®')).resolves.toBeNull();
    });
  });

  it('reuses the Twitch token across requests', async () => {
    await igdb.getGames([1]);
    await igdb.getTimesToBeat([1]);
    expect(tokenCalls()).toHaveLength(1);
  });

  it('sends the Twitch credentials in the body, never in the URL', async () => {
    await igdb.getGames([1]);
    const [url, init] = tokenCalls()[0];
    expect(urlOf(url).search).toBe('');
    const body = init?.body as URLSearchParams;
    expect(body.toString()).toBe(
      'client_id=client-id&client_secret=client-secret&grant_type=client_credentials',
    );
  });

  it('gets a new token and retries once when IGDB answers 401', async () => {
    let first = true;
    answers.games = () => {
      if (first) {
        first = false;
        return json({ message: 'Unauthorized' }, 401);
      }
      return json([]);
    };

    await expect(igdb.getGames([1])).resolves.toEqual([]);
    expect(tokenCalls()).toHaveLength(2);
  });

  it('never puts the secret in error messages', async () => {
    fetchMock.mockResolvedValue(json({}, 400));
    const error: Error = await igdb.getGames([1]).then(
      () => new Error('expected the call to fail'),
      (caught: Error) => caught,
    );
    expect(error.message).toBe('Twitch token request responded with 400');
  });
});

describe('normalizeTitle', () => {
  it.each([
    ['DOOM®', 'doom'],
    ['The Witcher® 3: Wild Hunt', 'the witcher 3 wild hunt'],
    ['Pokémon™  Legends', 'pokemon legends'],
    ['  ', ''],
  ])('%s → "%s"', (title, normalized) => {
    expect(normalizeTitle(title)).toBe(normalized);
  });
});
