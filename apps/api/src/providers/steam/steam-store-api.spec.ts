import {
  RATE_LIMIT_PAUSE_MS,
  SteamStoreApi,
  SteamStoreRateLimitError,
} from './steam-store-api.js';

describe('SteamStoreApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let store: SteamStoreApi;

  beforeEach(() => {
    // A new client per test: each one has its own request queue.
    store = new SteamStoreApi();
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

  it('reuses a recent answer instead of asking the store again', async () => {
    respond({
      '620': { success: true, data: { type: 'game', name: 'Portal 2' } },
    });
    await store.getAppDetails(620);
    await store.getAppDetails(620);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not remember failures', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            '620': { success: true, data: { type: 'game', name: 'Portal 2' } },
          }),
        ),
      );
    await expect(store.getAppDetails(620)).rejects.toThrow('500');
    await expect(store.getAppDetails(620)).resolves.toMatchObject({
      name: 'Portal 2',
    });
  });

  it('returns null when the app has no store page', async () => {
    respond({ '999': { success: false } });
    await expect(store.getAppDetails(999)).resolves.toBeNull();
  });

  describe('rate limit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits and tries once more after a 429', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('null', { status: 429 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              '620': {
                success: true,
                data: { type: 'game', name: 'Portal 2' },
              },
            }),
          ),
        );

      const details = store.getAppDetails(620);
      await vi.advanceTimersByTimeAsync(RATE_LIMIT_PAUSE_MS);

      await expect(details).resolves.toMatchObject({ name: 'Portal 2' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up with its own error if Steam still answers 429', async () => {
      fetchMock.mockImplementation(
        async () => new Response('null', { status: 429 }),
      );

      const details = store.getAppDetails(620);
      const assertion = expect(details).rejects.toBeInstanceOf(
        SteamStoreRateLimitError,
      );
      await vi.advanceTimersByTimeAsync(RATE_LIMIT_PAUSE_MS);
      await assertion;
    });
  });
});
