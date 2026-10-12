import { SteamStoreApi, SteamStoreRateLimitError } from './steam-store-api.js';

describe('SteamStoreApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const store = new SteamStoreApi();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('maps the store page data', async () => {
    respond({
      '620': {
        success: true,
        data: {
          type: 'game',
          name: 'Portal 2',
          short_description: 'The sequel to Portal.',
          header_image: 'https://cdn.example.com/620/header.jpg',
          developers: ['Valve'],
          genres: [{ id: '1', description: 'Action' }],
          categories: [{ id: 2, description: 'Single-player' }],
          metacritic: { score: 95, url: 'https://example.com' },
          release_date: { coming_soon: false, date: '18 Apr, 2011' },
        },
      },
    });

    await expect(store.getAppDetails(620)).resolves.toEqual({
      appId: 620,
      type: 'game',
      name: 'Portal 2',
      summary: 'The sequel to Portal.',
      headerImageUrl: 'https://cdn.example.com/620/header.jpg',
      developer: 'Valve',
      genres: ['Action'],
      categories: ['Single-player'],
      metacritic: 95,
      releaseDate: new Date('2011-04-18T00:00:00Z'),
      fullGameAppId: null,
    });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get('l')).toBe('english');
  });

  it('links DLC and demos to their full game', async () => {
    respond({
      '1234': {
        success: true,
        data: {
          type: 'demo',
          name: 'Hades Demo',
          fullgame: { appid: '1145360' },
        },
      },
    });
    await expect(store.getAppDetails(1234)).resolves.toMatchObject({
      type: 'demo',
      fullGameAppId: 1145360,
    });
  });

  it('has no release date for unreleased or vaguely dated games', async () => {
    respond({
      '1': {
        success: true,
        data: {
          type: 'game',
          name: 'Soon',
          release_date: { coming_soon: true, date: 'Q4 2026' },
        },
      },
    });
    await expect(store.getAppDetails(1)).resolves.toMatchObject({
      releaseDate: null,
    });
  });

  it('returns null when the app has no store page', async () => {
    respond({ '999': { success: false } });
    await expect(store.getAppDetails(999)).resolves.toBeNull();
  });

  it('signals the rate limit with its own error', async () => {
    respond(null, 429);
    await expect(store.getAppDetails(620)).rejects.toBeInstanceOf(
      SteamStoreRateLimitError,
    );
  });
});
