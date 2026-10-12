import { ConfigService } from '@nestjs/config';
import { SteamWebApi } from './steam-web-api.js';

describe('SteamWebApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const steam = new SteamWebApi({
    get: () => 'secret-key',
  } as unknown as ConfigService<never, true>);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  describe('getOwnedGames', () => {
    it('maps the games and their playtime', async () => {
      respond({
        response: {
          game_count: 2,
          games: [{ appid: 620, playtime_forever: 1200 }, { appid: 400 }],
        },
      });

      await expect(steam.getOwnedGames('76561197960287930')).resolves.toEqual({
        gameCount: 2,
        games: [
          { appId: 620, playtimeMinutes: 1200 },
          { appId: 400, playtimeMinutes: 0 },
        ],
      });
    });

    it('returns null when the game details are private', async () => {
      respond({ response: {} });
      await expect(
        steam.getOwnedGames('76561197960287930'),
      ).resolves.toBeNull();
    });

    it('accepts a public library with no games', async () => {
      respond({ response: { game_count: 0 } });
      await expect(steam.getOwnedGames('76561197960287930')).resolves.toEqual({
        gameCount: 0,
        games: [],
      });
    });
  });

  it('never puts the key in error messages', async () => {
    respond({}, 500);
    await expect(steam.getPlayerSummary('1')).rejects.toThrow(
      'Steam Web API ISteamUser/GetPlayerSummaries/v2/ responded with 500',
    );
    await expect(steam.getPlayerSummary('1')).rejects.not.toThrow(/secret-key/);
  });
});
