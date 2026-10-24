import { cleanGiveawayTitle, GamerPowerApi } from './gamerpower-api.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const giveaway = (overrides: Record<string, unknown> = {}) => ({
  id: 3200,
  title: 'Hogwarts Legacy (Epic Games) Giveaway',
  worth: '$59.99',
  thumbnail: 'https://www.gamerpower.com/offers/1/x.jpg',
  image: 'https://www.gamerpower.com/offers/1b/x.jpg',
  description: '...',
  instructions: '...',
  open_giveaway_url: 'https://www.gamerpower.com/open/hogwarts-legacy',
  published_date: '2026-10-23 17:00:00',
  type: 'Game',
  platforms: 'PC, Epic Games Store',
  end_date: '2026-10-30 23:59:00',
  users: 52000,
  status: 'Active',
  gamerpower_url: 'https://www.gamerpower.com/hogwarts-legacy',
  ...overrides,
});

describe('cleanGiveawayTitle', () => {
  it.each([
    ['Hogwarts Legacy (Epic Games) Giveaway', 'Hogwarts Legacy'],
    ['Death Stranding (Steam) Giveaway', 'Death Stranding'],
    ['Little Nightmares Giveaway', 'Little Nightmares'],
    ['Dwarven Realms (Steam) Key Giveaway', 'Dwarven Realms'],
    ['Some Game (Epic Games Store) Free Giveaway', 'Some Game'],
    ['Alien: Isolation', 'Alien: Isolation'],
  ])('%s → %s', (title, clean) => {
    expect(cleanGiveawayTitle(title)).toBe(clean);
  });
});

describe('GamerPowerApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const api = new GamerPowerApi();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for games in the official stores only', async () => {
    fetchMock.mockResolvedValue(json([]));
    await api.freeGames();
    const url = fetchMock.mock.calls[0]![0] as URL;
    expect(url.searchParams.get('platform')).toBe('epic-games-store.steam.gog');
    expect(url.searchParams.get('type')).toBe('game');
  });

  it('reads each giveaway with a clean title, its stores and end date', async () => {
    fetchMock.mockResolvedValue(
      json([
        giveaway(),
        giveaway({
          id: 3201,
          title: 'Some Game Giveaway',
          worth: 'N/A',
          platforms: 'PC, Android, iOS, Steam, DRM-Free',
          end_date: 'N/A',
        }),
      ]),
    );
    await expect(api.freeGames()).resolves.toEqual([
      {
        id: 3200,
        title: 'Hogwarts Legacy',
        worth: '$59.99',
        imageUrl: 'https://www.gamerpower.com/offers/1b/x.jpg',
        url: 'https://www.gamerpower.com/open/hogwarts-legacy',
        stores: ['Epic Games Store'],
        endsAt: new Date('2026-10-30T23:59:00Z'),
      },
      expect.objectContaining({
        id: 3201,
        title: 'Some Game',
        worth: null,
        stores: ['Steam'],
        endsAt: null,
      }),
    ]);
  });

  it('takes the "nothing found" answer (201) as an empty list', async () => {
    fetchMock.mockResolvedValue(
      json({ status: 0, status_message: 'No active giveaways available' }, 201),
    );
    await expect(api.freeGames()).resolves.toEqual([]);
  });

  it('leaves out expired ones and anything that is not a game', async () => {
    fetchMock.mockResolvedValue(
      json([giveaway({ status: 'Expired' }), giveaway({ id: 9, type: 'DLC' })]),
    );
    await expect(api.freeGames()).resolves.toEqual([]);
  });
});
