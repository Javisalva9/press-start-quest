import { ConfigService } from '@nestjs/config';
import { ItadApi, ItadError } from './itad-api.js';

const configWith = (key: string | undefined) =>
  ({ get: () => key }) as unknown as ConfigService<never, true>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const urlOf = (input: unknown) => input as URL;

const euros = (amount: number) => ({ amount, currency: 'EUR' });

describe('ItadApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let itad: ItadApi;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    itad = new ItadApi(configWith('secret-key'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is off without a key', () => {
    expect(new ItadApi(configWith(undefined)).enabled).toBe(false);
    expect(new ItadApi(configWith('')).enabled).toBe(false);
    expect(itad.enabled).toBe(true);
  });

  it('finds ITAD ids from Steam appids', async () => {
    fetchMock.mockResolvedValue(
      json({ 'app/620': 'uuid-portal-2', 'app/999': null }),
    );

    await expect(itad.findBySteamAppIds([620, 999])).resolves.toEqual(
      new Map([[620, 'uuid-portal-2']]),
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(urlOf(url).pathname).toBe('/lookup/id/shop/61/v1');
    expect(urlOf(url).searchParams.get('key')).toBe('secret-key');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(['app/620', 'app/999']);
  });

  it('reads the best price and the historical low, for a country and shops', async () => {
    fetchMock.mockResolvedValue(
      json({
        prices: [
          {
            id: 'uuid-1',
            current: {
              shop: { id: 35, name: 'GOG' },
              price: euros(4.99),
              regular: euros(19.99),
              cut: 75,
              expiry: '2026-10-30T17:00:00+00:00',
              url: 'https://itad.link/abc/',
              drm: [],
            },
            lowest: {
              shop: { id: 61, name: 'Steam' },
              price: euros(3.99),
              regular: euros(19.99),
              cut: 80,
              timestamp: '2025-06-26T17:00:00+00:00',
            },
            bundled: 0,
            urls: { game: 'https://isthereanydeal.com/game/x/' },
          },
          { id: 'uuid-2', current: null, lowest: null },
        ],
        bundles: [],
      }),
    );

    await expect(
      itad.prices(['uuid-1', 'uuid-2'], [61, 35], 'ES'),
    ).resolves.toEqual([
      {
        itadId: 'uuid-1',
        current: {
          shop: 'GOG',
          shopId: 35,
          price: 4.99,
          regularPrice: 19.99,
          cutPct: 75,
          currency: 'EUR',
          url: 'https://itad.link/abc/',
          expiresAt: new Date('2026-10-30T17:00:00Z'),
        },
        lowest: { price: 3.99, at: new Date('2025-06-26T17:00:00Z') },
      },
      { itadId: 'uuid-2', current: null, lowest: null },
    ]);
    const url = urlOf(fetchMock.mock.calls[0]![0]);
    expect(url.pathname).toBe('/games/overview/v2');
    expect(url.searchParams.get('country')).toBe('ES');
    expect(url.searchParams.get('shops')).toBe('61,35');
  });

  it('fails with the status, never with the URL and its key', async () => {
    fetchMock.mockResolvedValue(json({ error: 'nope' }, 403));
    const error = await itad.shops('ES').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ItadError);
    expect(String(error)).not.toContain('secret-key');
  });
});
