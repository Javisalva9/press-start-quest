import { SteamLibraryProvider } from './steam-library.provider.js';
import type { SteamWebApi } from './steam-web-api.js';

describe('SteamLibraryProvider', () => {
  const steam = {
    getOwnedGames: vi.fn(),
    getPlayerAchievements: vi.fn(),
    getWishlist: vi.fn(),
  };
  const provider = new SteamLibraryProvider(steam as unknown as SteamWebApi);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('turns owned games into library games keyed by appid', async () => {
    steam.getOwnedGames.mockResolvedValue({
      gameCount: 1,
      games: [
        {
          appId: 620,
          name: 'Portal 2',
          playtimeMinutes: 1200,
          playtimeTwoWeeksMinutes: 90,
          lastPlayedAt: null,
        },
      ],
    });

    await expect(provider.getLibrary('steam-id')).resolves.toEqual([
      {
        externalAppId: '620',
        title: 'Portal 2',
        playtimeMinutes: 1200,
        recentPlaytimeMinutes: 90,
        lastPlayedAt: null,
      },
    ]);
  });

  it('returns null for a private library', async () => {
    steam.getOwnedGames.mockResolvedValue(null);
    await expect(provider.getLibrary('steam-id')).resolves.toBeNull();
  });

  it('asks Steam for achievements with the numeric appid', async () => {
    steam.getPlayerAchievements.mockResolvedValue(null);
    await provider.getAchievements('steam-id', '620');
    expect(steam.getPlayerAchievements).toHaveBeenCalledWith('steam-id', 620);
  });

  it('rejects an appid that is not a Steam one', async () => {
    await expect(provider.getAchievements('steam-id', 'abc')).rejects.toThrow(
      'Not a Steam appid',
    );
  });

  it('sorts the wishlist: ranked first, then newest', async () => {
    steam.getWishlist.mockResolvedValue([
      { appId: 1, priority: 0, addedAt: new Date('2025-01-01') },
      { appId: 2, priority: 2, addedAt: new Date('2024-01-01') },
      { appId: 3, priority: 0, addedAt: new Date('2026-01-01') },
      { appId: 4, priority: 1, addedAt: new Date('2023-01-01') },
    ]);

    const wishlist = await provider.getWishlist('steam-id');

    expect(wishlist.map((game) => game.externalAppId)).toEqual([
      '4',
      '2',
      '3',
      '1',
    ]);
    expect(wishlist[2].priority).toBeNull();
  });
});
