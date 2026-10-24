import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PQueue from 'p-queue';
import { z } from 'zod';
import { chunk } from '../../common/chunk.js';
import type { Env } from '../../config/env.js';

const ITAD_URL = 'https://api.isthereanydeal.com';
/** ITAD's id for Steam, to look games up by their appid. */
const STEAM_SHOP = 61;
/** Ids per request: well within what ITAD takes, and small bodies. */
const BATCH = 100;

const ShopsSchema = z.array(
  z.object({ id: z.number().int(), title: z.string() }),
);

/** "app/620" → ITAD id, or null when ITAD doesn't know the game. */
const LookupSchema = z.record(z.string(), z.string().nullable());

const PriceSchema = z.object({ amount: z.number(), currency: z.string() });

const OverviewSchema = z.object({
  prices: z.array(
    z.object({
      id: z.string(),
      /** The best price right now in the shops asked for; null if none sells it. */
      current: z
        .object({
          shop: z.object({ id: z.number().int(), name: z.string() }),
          price: PriceSchema,
          regular: PriceSchema,
          cut: z.number().int(),
          expiry: z.string().nullable().optional(),
          url: z.string(),
        })
        .nullable(),
      /** The lowest price ever in those shops. */
      lowest: z
        .object({ price: PriceSchema, timestamp: z.string() })
        .nullable(),
    }),
  ),
});

export interface ItadShop {
  id: number;
  title: string;
}

export interface ItadPrice {
  itadId: string;
  current: {
    shop: string;
    /** ITAD's id for the shop, to name it as our list does. */
    shopId: number;
    price: number;
    regularPrice: number;
    cutPct: number;
    currency: string;
    url: string;
    expiresAt: Date | null;
  } | null;
  lowest: { price: number; at: Date } | null;
}

/** ITAD answered with an error; the message never includes the key. */
export class ItadError extends Error {
  constructor(readonly status: number) {
    super(`IsThereAnyDeal answered ${status}`);
  }
}

/**
 * Client for IsThereAnyDeal: prices and historical lows per country and
 * shop. Optional: without ITAD_API_KEY, `enabled` is false and nobody
 * calls it. ITAD reserves the right to cut abusive clients off, so the
 * requests go one by one, at most two a second.
 */
@Injectable()
export class ItadApi {
  private readonly key: string | undefined;
  private readonly queue = new PQueue({
    concurrency: 1,
    intervalCap: 2,
    interval: 1000,
  });

  constructor(config: ConfigService<Env, true>) {
    // An empty value counts as not set, whichever way it arrives.
    this.key = config.get('ITAD_API_KEY', { infer: true }) || undefined;
  }

  get enabled(): boolean {
    return this.key !== undefined;
  }

  /** The shops ITAD covers in a country (ES for Spain). */
  async shops(country: string): Promise<ItadShop[]> {
    return ShopsSchema.parse(
      await this.request('/service/shops/v1', { country }),
    );
  }

  /** ITAD id of each Steam appid ITAD knows: appid → ITAD id. */
  async findBySteamAppIds(appIds: number[]): Promise<Map<number, string>> {
    const matches = new Map<number, string>();
    for (const batch of chunk(appIds, BATCH)) {
      const rows = LookupSchema.parse(
        await this.request(
          `/lookup/id/shop/${STEAM_SHOP}/v1`,
          {},
          batch.map((appId) => `app/${appId}`),
        ),
      );
      for (const [steamId, itadId] of Object.entries(rows)) {
        const appId = Number(steamId.replace('app/', ''));
        if (itadId && Number.isInteger(appId)) {
          matches.set(appId, itadId);
        }
      }
    }
    return matches;
  }

  /** Best current price and historical low of each game, in those shops. */
  async prices(
    itadIds: string[],
    shopIds: number[],
    country: string,
  ): Promise<ItadPrice[]> {
    const prices: ItadPrice[] = [];
    for (const batch of chunk(itadIds, BATCH)) {
      const { prices: rows } = OverviewSchema.parse(
        await this.request(
          '/games/overview/v2',
          { country, shops: shopIds.join(',') },
          batch,
        ),
      );
      prices.push(
        ...rows.map((row) => ({
          itadId: row.id,
          current: row.current && {
            shop: row.current.shop.name,
            shopId: row.current.shop.id,
            price: row.current.price.amount,
            regularPrice: row.current.regular.amount,
            cutPct: row.current.cut,
            currency: row.current.price.currency,
            url: row.current.url,
            expiresAt: row.current.expiry ? new Date(row.current.expiry) : null,
          },
          lowest: row.lowest && {
            price: row.lowest.price.amount,
            at: new Date(row.lowest.timestamp),
          },
        })),
      );
    }
    return prices;
  }

  /** GET without a body, POST with one (a JSON list of ids). */
  private request(
    path: string,
    params: Record<string, string>,
    body?: unknown,
  ): Promise<unknown> {
    if (!this.key) {
      throw new Error('ITAD_API_KEY is not set');
    }
    const url = new URL(path, ITAD_URL);
    url.search = new URLSearchParams({ key: this.key, ...params }).toString();
    return this.queue.add(async () => {
      const response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new ItadError(response.status);
      }
      return response.json() as Promise<unknown>;
    });
  }
}
