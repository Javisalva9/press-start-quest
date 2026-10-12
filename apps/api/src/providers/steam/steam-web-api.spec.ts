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
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify(body), { status }),
    );

  // SteamWebApi always calls fetch with a URL object.
  const requestedUrl = () => fetchMock.mock.calls[0][0] as URL;

  describe('getOwnedGames', () => {
    it('maps names, playtime and last session', async () => {
      respond({
        response: {
          game_count: 2,
          games: [
            {
              appid: 620,
              name: 'Portal 2',
              playtime_forever: 1200,
              playtime_2weeks: 90,
              rtime_last_played: 1_760_000_000,
            },
            { appid: 400, name: 'Portal', rtime_last_played: 0 },
          ],
        },
      });

      await expect(steam.getOwnedGames('76561197960287930')).resolves.toEqual({
        gameCount: 2,
        games: [
          {
            appId: 620,
            name: 'Portal 2',
            playtimeMinutes: 1200,
            playtimeTwoWeeksMinutes: 90,
            lastPlayedAt: new Date(1_760_000_000_000),
          },
          {
            appId: 400,
            name: 'Portal',
            playtimeMinutes: 0,
            playtimeTwoWeeksMinutes: 0,
            lastPlayedAt: null,
          },
        ],
      });
      expect(requestedUrl().searchParams.get('include_appinfo')).toBe('1');
      expect(requestedUrl().searchParams.get('include_played_free_games')).toBe(
        '1',
      );
    });

    it('returns null when the game details are private', async () => {
      respond({ response: {} });
      await expect(steam.getOwnedGames('1')).resolves.toBeNull();
    });

    it('accepts a public library with no games', async () => {
      respond({ response: { game_count: 0 } });
      await expect(steam.getOwnedGames('1')).resolves.toEqual({
        gameCount: 0,
        games: [],
      });
    });
  });

  describe('getPlayerAchievements', () => {
    it('maps unlocked and locked achievements', async () => {
      respond({
        playerstats: {
          success: true,
          achievements: [
            {
              apiname: 'ACH_WIN',
              achieved: 1,
              unlocktime: 1_760_000_000,
              name: 'The End',
              description: 'Finish the game',
            },
            { apiname: 'ACH_SECRET', achieved: 0, unlocktime: 0 },
          ],
        },
      });

      await expect(steam.getPlayerAchievements('1', 620)).resolves.toEqual([
        {
          apiName: 'ACH_WIN',
          name: 'The End',
          description: 'Finish the game',
          unlockedAt: new Date(1_760_000_000_000),
        },
        {
          apiName: 'ACH_SECRET',
          name: 'ACH_SECRET',
          description: '',
          unlockedAt: null,
        },
      ]);
      expect(requestedUrl().searchParams.get('l')).toBe('english');
    });

    it('returns null for games without achievements', async () => {
      respond(
        {
          playerstats: { success: false, error: 'Requested app has no stats' },
        },
        400,
      );
      await expect(steam.getPlayerAchievements('1', 620)).resolves.toBeNull();
    });

    it('returns null when the game has stats but no achievements', async () => {
      respond({ playerstats: { success: true } });
      await expect(steam.getPlayerAchievements('1', 620)).resolves.toBeNull();
    });

    it('fails on any other error', async () => {
      respond(
        { playerstats: { success: false, error: 'Profile is not public' } },
        403,
      );
      await expect(steam.getPlayerAchievements('1', 620)).rejects.toThrow(
        'responded with 403',
      );
    });
  });

  describe('getWishlist', () => {
    it('maps items with their priority and date', async () => {
      respond({
        response: {
          items: [{ appid: 1145360, priority: 1, date_added: 1_750_000_000 }],
        },
      });
      await expect(steam.getWishlist('1')).resolves.toEqual([
        {
          appId: 1145360,
          priority: 1,
          addedAt: new Date(1_750_000_000_000),
        },
      ]);
    });

    it('returns an empty list for a private or empty wishlist', async () => {
      respond({ response: {} });
      await expect(steam.getWishlist('1')).resolves.toEqual([]);
    });
  });

  it('never puts the key in error messages', async () => {
    respond({}, 500);
    const error: Error = await steam.getPlayerSummary('1').then(
      () => new Error('expected the call to fail'),
      (caught: Error) => caught,
    );
    expect(error.message).toBe(
      'Steam Web API ISteamUser/GetPlayerSummaries/v2/ responded with 500',
    );
    expect(error.message).not.toContain('secret-key');
  });
});
