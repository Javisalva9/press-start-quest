import { Injectable } from '@nestjs/common';
import type {
  Mood,
  NextRecommendation,
  Recommendation,
  RecommendationRanking,
} from '@psq/shared';
import {
  GameKind,
  GameStatus,
  GameType,
  ServerStatus,
  TagKind,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { affinityByGame } from './queries/affinity.js';
import {
  fitsMood,
  pickAlternatives,
  scoreCandidate,
  type Candidate,
} from './scoring.js';

/** Statuses of a game still waiting to be played or finished. */
const OPEN_STATUSES = [
  GameStatus.BACKLOG,
  GameStatus.PLAYING,
  GameStatus.ON_HOLD,
];

/** How many alternatives come with the main pick. */
const ALTERNATIVES = 2;

type Ranked = Recommendation;

/**
 * "Your next game": scores every game of the backlog with the formula in
 * scoring.ts and offers the best, plus two of other genres.
 *
 * Out before scoring: completed, abandoned and "won't play it" games, the
 * wishlist, endless games, closed servers, partly closed ones without a
 * story, hidden games and the ones snoozed with "not now".
 */
@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async next(
    userId: string,
    mood: Mood | null,
    skip: number,
    now = new Date(),
  ): Promise<NextRecommendation> {
    const ranked = await this.rank(userId, mood, now);
    if (ranked.length === 0) {
      return { mood, pick: null, alternatives: [], candidates: 0 };
    }
    // "Another one" goes round: after the last, the best again.
    const pick = ranked[skip % ranked.length]!;
    return {
      mood,
      pick,
      alternatives: pickAlternatives(pick, ranked, ALTERNATIVES),
      candidates: ranked.length,
    };
  }

  async ranking(
    userId: string,
    mood: Mood | null,
    limit: number,
    now = new Date(),
  ): Promise<RecommendationRanking> {
    const ranked = await this.rank(userId, mood, now);
    return { mood, items: ranked.slice(0, limit), candidates: ranked.length };
  }

  /** Every game that fits, best first. */
  private async rank(
    userId: string,
    mood: Mood | null,
    now: Date,
  ): Promise<Ranked[]> {
    const entries = await this.prisma.userGame.findMany({
      where: {
        userId,
        owned: true,
        hidden: false,
        status: { in: OPEN_STATUSES },
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
        game: { kind: GameKind.GAME },
      },
      select: {
        id: true,
        gameId: true,
        status: true,
        playtimeMin: true,
        lastPlayedAt: true,
        typeOverride: true,
        serverOverride: true,
        game: {
          select: {
            title: true,
            coverUrl: true,
            heroUrl: true,
            steamAppId: true,
            ttbMainMin: true,
            ttbExtraMin: true,
            rating: true,
            ratingCount: true,
            metacritic: true,
            gameType: true,
            serverStatus: true,
            serverClosedAt: true,
            tags: {
              where: { tag: { kind: TagKind.GENRE } },
              select: { tag: { select: { name: true } } },
            },
          },
        },
      },
    });

    const open = entries
      .map((entry) => {
        const type = entry.typeOverride ?? entry.game.gameType;
        const servers = entry.serverOverride ?? entry.game.serverStatus;
        // The player's own estimate is saved as the "normal" length.
        const lengthMin = entry.game.ttbMainMin ?? entry.game.ttbExtraMin;
        return { entry, type, servers, lengthMin };
      })
      .filter(
        ({ type, servers, lengthMin }) =>
          type !== GameType.ENDLESS &&
          servers !== ServerStatus.CLOSED &&
          // Online closed, campaign still playable: only if it has one.
          (servers !== ServerStatus.PARTIAL || lengthMin !== null),
      );
    if (open.length === 0) {
      return [];
    }

    const gameIds = open.map(({ entry }) => entry.gameId);
    const [affinities, picks] = await Promise.all([
      affinityByGame(this.prisma, userId, gameIds),
      this.prisma.curatorPick.findMany({
        where: {
          gameId: { in: gameIds },
          curator: { followers: { some: { userId } } },
        },
        select: { gameId: true, curator: { select: { name: true } } },
        orderBy: { curator: { name: 'asc' } },
      }),
    ]);
    const affinity = new Map(affinities.map((row) => [row.gameId, row]));
    // Compared with the best fit of this backlog: it gets 1.
    const best = Math.max(0, ...affinities.map((row) => Number(row.raw)));
    const curators = new Map<string, string[]>();
    for (const { gameId, curator } of picks) {
      curators.set(gameId, [...(curators.get(gameId) ?? []), curator.name]);
    }

    return open
      .map(({ entry, type, servers, lengthMin }) => {
        const fit = affinity.get(entry.gameId);
        const candidate: Candidate = {
          playtimeMin: entry.playtimeMin,
          playing: entry.status === GameStatus.PLAYING,
          lastPlayedAt: entry.lastPlayedAt,
          lengthMin,
          sandbox: type === GameType.SANDBOX,
          rating: entry.game.rating,
          ratingCount: entry.game.ratingCount,
          metacritic: entry.game.metacritic,
          affinity: best > 0 && fit ? Number(fit.raw) / best : 0,
          topTag:
            fit?.topTag && fit.topKind
              ? { name: fit.topTag, kind: fit.topKind }
              : null,
          curators: curators.get(entry.gameId) ?? [],
          closing:
            servers === ServerStatus.ANNOUNCED
              ? { at: entry.game.serverClosedAt }
              : null,
        };
        return { entry, candidate };
      })
      .filter(({ candidate }) => fitsMood(candidate, mood))
      .map(({ entry, candidate }): Ranked => {
        const scored = scoreCandidate(candidate, mood, now);
        return {
          id: entry.id,
          title: entry.game.title,
          coverUrl: entry.game.coverUrl,
          heroUrl: entry.game.heroUrl,
          steamAppId: entry.game.steamAppId,
          playtimeMinutes: entry.playtimeMin,
          remainingMinutes: scored.remainingMin,
          genres: entry.game.tags.map(({ tag }) => tag.name),
          score: scored.score,
          factors: scored.factors,
          reasons: scored.reasons,
        };
      })
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }
}
