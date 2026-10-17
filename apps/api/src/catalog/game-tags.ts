import type { PrismaService } from '../prisma/prisma.service.js';
import type { GameTag } from './game-metadata.js';

/**
 * Replaces the tags of some games (genres, themes, modes…): creates the
 * tags nobody had yet and links each game to exactly its own. Used by the
 * catalog enricher and by games added by hand.
 */
export async function saveGameTags(
  prisma: PrismaService,
  tagsByGame: Array<[gameId: string, tags: GameTag[]]>,
): Promise<void> {
  if (tagsByGame.length === 0) {
    return;
  }
  const allTags = tagsByGame.flatMap(([, tags]) => tags);
  if (allTags.length > 0) {
    await prisma.tag.createMany({ data: allTags, skipDuplicates: true });
  }
  const tags = await prisma.tag.findMany({
    where: { name: { in: [...new Set(allTags.map((tag) => tag.name))] } },
    select: { id: true, name: true, kind: true },
  });
  const tagId = new Map(tags.map((tag) => [`${tag.kind}:${tag.name}`, tag.id]));

  await prisma.$transaction([
    prisma.gameTag.deleteMany({
      where: { gameId: { in: tagsByGame.map(([gameId]) => gameId) } },
    }),
    prisma.gameTag.createMany({
      data: tagsByGame.flatMap(([gameId, gameTags]) =>
        gameTags.flatMap((tag) => {
          const id = tagId.get(`${tag.kind}:${tag.name}`);
          return id ? [{ gameId, tagId: id }] : [];
        }),
      ),
      skipDuplicates: true,
    }),
  ]);
}
