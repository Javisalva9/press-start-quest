import type { LibraryGame } from '../providers/library-provider.js';

/** What the database already knows about a game in one store. */
export interface StoredOwnership {
  externalAppId: string;
  playtimeMin: number;
  playtime2wMin: number;
  lastPlayedAt: Date | null;
}

export interface OwnershipChanges {
  /** Games that weren't in this store's library before. */
  added: LibraryGame[];
  /** Known games whose playtime or last session changed. */
  changed: LibraryGame[];
}

/**
 * Compares what the store reports with what is stored, so a sync only
 * writes what's new or different: the first one saves the whole library,
 * the next ones a handful of rows.
 */
export function diffOwnerships(
  stored: StoredOwnership[],
  fetched: LibraryGame[],
): OwnershipChanges {
  const storedByAppId = new Map(
    stored.map((ownership) => [ownership.externalAppId, ownership]),
  );
  const added: LibraryGame[] = [];
  const changed: LibraryGame[] = [];

  for (const game of fetched) {
    const current = storedByAppId.get(game.externalAppId);
    if (!current) {
      added.push(game);
    } else if (
      current.playtimeMin !== game.playtimeMinutes ||
      current.playtime2wMin !== game.recentPlaytimeMinutes ||
      (current.lastPlayedAt?.getTime() ?? null) !==
        (game.lastPlayedAt?.getTime() ?? null)
    ) {
      changed.push(game);
    }
  }
  return { added, changed };
}
