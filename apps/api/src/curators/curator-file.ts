import { readdirSync, readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * A global curator's list, as resolved by scripts/resolve-curator-list.mjs
 * into data/curators/<name>.json (next to the hand-written .source.json).
 */
const CuratorFileSchema = z.object({
  curator: z.object({
    name: z.string().min(1),
    kind: z.literal('CREATOR'),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
  }),
  games: z
    .array(
      z.object({
        igdbId: z.number().int().positive(),
        title: z.string(),
        year: z.number().int().nullable(),
        listedAs: z.array(z.string()).min(1),
      }),
    )
    .min(1),
});

export type CuratorFile = z.infer<typeof CuratorFileSchema>;

/** apps/api/data/curators, two levels above both src/curators and dist/curators. */
const CURATORS_DIR = new URL('../../data/curators/', import.meta.url);

/** Every resolved list; a malformed one fails loudly. */
export function loadCuratorFiles(dir: URL = CURATORS_DIR): CuratorFile[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.source.json'))
    .sort()
    .map((file) =>
      CuratorFileSchema.parse(
        JSON.parse(readFileSync(new URL(file, dir), 'utf8')),
      ),
    );
}
