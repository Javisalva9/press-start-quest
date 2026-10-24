import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const GAMERPOWER_URL = 'https://www.gamerpower.com/api/filter';

/**
 * Official stores only, as GamerPower names its platforms. "pc" would
 * also bring keys handed out by third-party sites.
 */
export const FREE_GAME_PLATFORMS = ['epic-games-store', 'steam', 'gog'];

/** The same stores, as GamerPower names them in each giveaway. */
const PC_STORES = ['Epic Games Store', 'Steam', 'GOG'];

/** GamerPower's dates: "2026-10-30 23:59:00" (UTC) or "N/A". */
const DateSchema = z
  .string()
  .transform((text) =>
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
      ? new Date(`${text.replace(' ', 'T')}Z`)
      : null,
  );

const GiveawaySchema = z.object({
  id: z.number().int(),
  title: z.string(),
  worth: z.string(),
  image: z.string(),
  open_giveaway_url: z.string(),
  platforms: z.string(),
  type: z.string(),
  status: z.string().optional(),
  end_date: DateSchema,
});

export interface Giveaway {
  id: number;
  title: string;
  worth: string | null;
  imageUrl: string;
  url: string;
  stores: string[];
  endsAt: Date | null;
}

/**
 * GamerPower's titles carry the store and words like "Giveaway":
 * "Hogwarts Legacy (Epic Games) Giveaway" → "Hogwarts Legacy",
 * "Dwarven Realms (Steam) Key Giveaway" → "Dwarven Realms".
 */
export function cleanGiveawayTitle(title: string): string {
  return title
    .replace(/\s*\((?:Epic Games(?: Store)?|Steam|GOG(?:\.com)?)\)/gi, '')
    .replace(/\s+(?:Free\s+)?(?:Steam\s+)?(?:Key\s+)?Giveaway$/i, '')
    .trim();
}

/**
 * Client for GamerPower: active game giveaways. No key; one request a
 * night. GamerPower answers 201 with a status message when nothing
 * matches, instead of an empty list.
 */
@Injectable()
export class GamerPowerApi {
  async freeGames(): Promise<Giveaway[]> {
    const url = new URL(GAMERPOWER_URL);
    url.search = new URLSearchParams({
      platform: FREE_GAME_PLATFORMS.join('.'),
      type: 'game',
      'sort-by': 'date',
    }).toString();
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`GamerPower answered ${response.status}`);
    }
    const body: unknown = await response.json();
    if (response.status === 201 || !Array.isArray(body)) {
      return [];
    }
    return z
      .array(GiveawaySchema)
      .parse(body)
      .filter(
        (giveaway) =>
          giveaway.type === 'Game' &&
          (giveaway.status ?? 'Active') === 'Active',
      )
      .map((giveaway) => ({
        id: giveaway.id,
        title: cleanGiveawayTitle(giveaway.title),
        worth: /\d/.test(giveaway.worth) ? giveaway.worth : null,
        imageUrl: giveaway.image,
        url: giveaway.open_giveaway_url,
        // Only the PC stores: the same giveaway may list Android or iOS.
        stores: giveaway.platforms
          .split(',')
          .map((platform) => platform.trim())
          .filter((platform) => PC_STORES.includes(platform)),
        endsAt: giveaway.end_date,
      }));
  }
}
