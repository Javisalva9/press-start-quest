import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { SteamWebApi } from '../providers/steam/steam-web-api.js';
import { SteamPrivacyService } from './steam-privacy.service.js';

describe('SteamPrivacyService', () => {
  const prisma = { source: { findFirst: vi.fn() } };
  const steam = { getPlayerSummary: vi.fn(), getOwnedGames: vi.fn() };
  let service: SteamPrivacyService;

  const publicProfile = {
    steamid: '76561197960287930',
    personaname: 'Javi',
    communityvisibilitystate: 3,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.source.findFirst.mockResolvedValue({
      externalId: '76561197960287930',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        SteamPrivacyService,
        { provide: PrismaService, useValue: prisma },
        { provide: SteamWebApi, useValue: steam },
      ],
    }).compile();
    service = moduleRef.get(SteamPrivacyService);
  });

  it('reports a public profile with its game count', async () => {
    steam.getPlayerSummary.mockResolvedValue(publicProfile);
    steam.getOwnedGames.mockResolvedValue({
      gameCount: 2,
      games: [
        { appId: 620, playtimeMinutes: 1200 },
        { appId: 400, playtimeMinutes: 0 },
      ],
    });

    await expect(service.check('u1')).resolves.toEqual({
      status: 'PUBLIC',
      gameCount: 2,
    });
  });

  it('reports a private profile without asking for the games', async () => {
    steam.getPlayerSummary.mockResolvedValue({
      ...publicProfile,
      communityvisibilitystate: 1,
    });

    await expect(service.check('u1')).resolves.toEqual({
      status: 'PROFILE_PRIVATE',
      gameCount: null,
    });
    expect(steam.getOwnedGames).not.toHaveBeenCalled();
  });

  it('reports private game details', async () => {
    steam.getPlayerSummary.mockResolvedValue(publicProfile);
    steam.getOwnedGames.mockResolvedValue(null);

    await expect(service.check('u1')).resolves.toMatchObject({
      status: 'GAMES_PRIVATE',
    });
  });

  it('reports hidden playtime when every game shows 0 minutes', async () => {
    steam.getPlayerSummary.mockResolvedValue(publicProfile);
    steam.getOwnedGames.mockResolvedValue({
      gameCount: 2,
      games: [
        { appId: 620, playtimeMinutes: 0 },
        { appId: 400, playtimeMinutes: 0 },
      ],
    });

    await expect(service.check('u1')).resolves.toEqual({
      status: 'PLAYTIME_HIDDEN',
      gameCount: 2,
    });
  });

  it('treats an empty public library as public', async () => {
    steam.getPlayerSummary.mockResolvedValue(publicProfile);
    steam.getOwnedGames.mockResolvedValue({ gameCount: 0, games: [] });

    await expect(service.check('u1')).resolves.toMatchObject({
      status: 'PUBLIC',
    });
  });

  it('answers 404 when the user has no Steam account linked', async () => {
    prisma.source.findFirst.mockResolvedValue(null);
    await expect(service.check('u1')).rejects.toMatchObject({ status: 404 });
  });

  it('answers 503 when Steam fails', async () => {
    steam.getPlayerSummary.mockRejectedValue(new Error('timeout'));
    await expect(service.check('u1')).rejects.toMatchObject({ status: 503 });
  });
});
