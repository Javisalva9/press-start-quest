import { TagKind } from '../generated/prisma/client.js';
import type { IgdbGame, IgdbTimeToBeat } from '../providers/igdb/igdb-api.js';
import type { SteamAppDetails } from '../providers/steam/steam-store-api.js';
import { classifyGameKind } from './game-kind.js';

/** What each source said about one game (null: it has nothing on it). */
export interface GameSources {
  store: SteamAppDetails | null;
  igdb: IgdbGame | null;
  timeToBeat: IgdbTimeToBeat | null;
}

/**
 * Catalog fields to update. `undefined` means "leave it as it is": Prisma
 * ignores those, so a source that fails or has nothing never wipes data a
 * previous sync already saved.
 */
export interface GameMetadataUpdate {
  kind: ReturnType<typeof classifyGameKind>;
  igdbId?: number;
  coverUrl?: string;
  heroUrl?: string;
  summary?: string;
  developer?: string;
  releaseDate?: Date;
  rating?: number;
  ratingCount?: number;
  metacritic?: number;
  ttbMainMin?: number | null;
  ttbExtraMin?: number | null;
  ttbCompleteMin?: number | null;
  ttbSource?: string;
}

/**
 * Merges the sources, each one where it's strongest:
 * - Steam Store: type, header image, summary, developer, Metacritic.
 * - IGDB: cover, rating, lengths; release date (the store's is text).
 * A length typed in by the user (ttbSource "manual") is never replaced.
 */
export function buildGameUpdate(
  game: { title: string; ttbSource: string | null },
  { store, igdb, timeToBeat }: GameSources,
): GameMetadataUpdate {
  const update: GameMetadataUpdate = {
    kind: classifyGameKind({ title: game.title, storeType: store?.type }),
    igdbId: igdb?.igdbId,
    coverUrl: igdb?.coverUrl ?? undefined,
    heroUrl: store?.headerImageUrl ?? undefined,
    summary: store?.summary ?? igdb?.summary ?? undefined,
    developer: store?.developer ?? igdb?.developer ?? undefined,
    releaseDate: igdb?.releaseDate ?? store?.releaseDate ?? undefined,
    rating: igdb?.rating ?? undefined,
    ratingCount: igdb?.ratingCount ?? undefined,
    metacritic: store?.metacritic ?? undefined,
  };

  const hasLength =
    timeToBeat &&
    (timeToBeat.mainMinutes ??
      timeToBeat.extraMinutes ??
      timeToBeat.completeMinutes);
  if (hasLength && game.ttbSource !== 'manual') {
    update.ttbMainMin = timeToBeat.mainMinutes;
    update.ttbExtraMin = timeToBeat.extraMinutes;
    update.ttbCompleteMin = timeToBeat.completeMinutes;
    update.ttbSource = 'igdb';
  }
  return update;
}

export interface GameTag {
  name: string;
  kind: TagKind;
}

/**
 * Tags used later for the taste profile and recommendations. Genres come
 * from IGDB (consistent across games); the store's are a fallback for games
 * IGDB doesn't know.
 */
export function buildGameTags({ store, igdb }: GameSources): GameTag[] {
  const genres = igdb?.genres.length ? igdb.genres : (store?.genres ?? []);
  const tags: GameTag[] = [
    ...genres.map((name) => ({ name, kind: TagKind.GENRE })),
    ...(igdb?.themes ?? []).map((name) => ({ name, kind: TagKind.THEME })),
    ...(igdb?.modes ?? []).map((name) => ({ name, kind: TagKind.MODE })),
    ...(igdb?.perspectives ?? []).map((name) => ({
      name,
      kind: TagKind.PERSPECTIVE,
    })),
    ...(store?.categories ?? []).map((name) => ({
      name,
      kind: TagKind.STORE_CATEGORY,
    })),
  ];
  // The same tag can't be linked twice to a game.
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = `${tag.kind}:${tag.name}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
