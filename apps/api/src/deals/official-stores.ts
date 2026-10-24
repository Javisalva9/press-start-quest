import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { ItadShop } from '../providers/itad/itad-api.js';

const SeedSchema = z
  .array(
    z.object({
      /** How the store is called in the app. */
      name: z.string().min(1),
      /** How ITAD may call it: its titles change a little over time. */
      itad: z.array(z.string().min(1)).min(1),
    }),
  )
  .min(1);

export type OfficialStore = z.infer<typeof SeedSchema>[number];

/** The file sits in apps/api/data, two levels above both src/ and dist/. */
const SEED_FILE = new URL('../../data/official-stores.json', import.meta.url);

/**
 * The stores whose prices count: official ones that sell the game
 * itself, never key marketplaces. Add a line to the file to add one.
 */
export function loadOfficialStores(file: URL = SEED_FILE): OfficialStore[] {
  return SeedSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

/** "Epic Game Store" and "epic-game-store" are the same. */
const normalize = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The ITAD shop ids of our official stores, among the shops ITAD covers
 * in a country. The ones it doesn't cover there (or calls differently)
 * come back as missing, to see in the log and fix in the file.
 */
export function matchOfficialShops(
  stores: OfficialStore[],
  shops: ItadShop[],
): { shopIds: number[]; matched: string[]; missing: string[] } {
  const byName = new Map(shops.map((shop) => [normalize(shop.title), shop.id]));
  const shopIds: number[] = [];
  const matched: string[] = [];
  const missing: string[] = [];
  for (const store of stores) {
    const ids = store.itad
      .map((title) => byName.get(normalize(title)))
      .filter((id): id is number => id !== undefined);
    if (ids.length > 0) {
      shopIds.push(...ids.filter((id) => !shopIds.includes(id)));
      matched.push(store.name);
    } else {
      missing.push(store.name);
    }
  }
  return { shopIds, matched, missing };
}
