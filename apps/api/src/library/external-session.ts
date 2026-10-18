import { Platform } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * A game only in external sources (a friend's copy, a store without an
 * API) has no sessions: nothing tells the app when it was last played.
 * When the player says they're playing it, that is today's session, so
 * it gets the "finish what you started" boost and its "still playing?"
 * card is counted from here.
 *
 * Games in a synced store (Steam) are left alone: the store knows when
 * they were really played. Returns whether a date was saved.
 */
export async function markPlayedToday(
  prisma: PrismaService,
  userGameId: string,
  now: Date,
): Promise<boolean> {
  const synced = await prisma.ownership.count({
    where: { userGameId, source: { platform: { not: Platform.EXTERNAL } } },
  });
  if (synced > 0) {
    return false;
  }
  const { count } = await prisma.ownership.updateMany({
    where: { userGameId, source: { platform: Platform.EXTERNAL } },
    data: { lastPlayedAt: now },
  });
  if (count === 0) {
    return false;
  }
  await prisma.userGame.update({
    where: { id: userGameId },
    data: { lastPlayedAt: now },
  });
  return true;
}
