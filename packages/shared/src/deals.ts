import { z } from 'zod';
import { RecommendedBySchema } from './curators.js';
import { TASTE_KINDS } from './recommendations.js';

/** The best current price of a game in an official store, from ITAD. */
export const DealPriceSchema = z.object({
  store: z.string(),
  price: z.number().nonnegative(),
  regularPrice: z.number().nonnegative(),
  /** Discount, 0–100; 0 is full price. */
  cutPct: z.number().int().min(0).max(100),
  /** EUR: the prices are for Spain. */
  currency: z.string(),
  /** The store's page, through IsThereAnyDeal's link. */
  url: z.string(),
  /** The cheapest it has ever been in the official stores. */
  isHistoricalLow: z.boolean(),
  lowestPrice: z.number().nonnegative().nullable(),
  /** When the offer ends, if the store says. */
  expiresAt: z.iso.datetime().nullable(),
});

export type DealPrice = z.infer<typeof DealPriceSchema>;

/** A game of the wishlist with its price, for the deals screen. */
export const DealSchema = DealPriceSchema.extend({
  /** Id of the library entry, for its page. */
  id: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  heroUrl: z.string().nullable(),
  /** IGDB's rating, or Metacritic's; 0–100. */
  rating: z.number().nullable(),
  /** Steam wishlist priority: 1 is the most wanted. */
  wishlistPriority: z.number().int().nullable(),
  recommendedBy: z.array(RecommendedBySchema),
  /** How well it fits the player's taste, 0–1, against the rest of the list. */
  fit: z.number().min(0).max(1),
  /** The tag that fits the most, for "your kind of game: RPG". */
  topTag: z.object({ name: z.string(), kind: z.enum(TASTE_KINDS) }).nullable(),
  /** "For you" order: taste, rating, discount, historical low, curators. */
  score: z.number(),
});

export type Deal = z.infer<typeof DealSchema>;

/** Response of GET /api/deals: every priced game of the wishlist. */
export const DealsResponseSchema = z.object({
  items: z.array(DealSchema),
  /** When the prices were last checked (every night). */
  updatedAt: z.iso.datetime().nullable(),
});

export type DealsResponse = z.infer<typeof DealsResponseSchema>;

/** A game given away for free right now in an official store. */
export const FreeGameSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  /** What it usually costs, as the source writes it ("$19.99"). */
  worth: z.string().nullable(),
  imageUrl: z.string(),
  /** The giveaway page. */
  url: z.string(),
  stores: z.array(z.string()),
  endsAt: z.iso.datetime().nullable(),
  /** Already in the player's library (by title). */
  owned: z.boolean(),
  /** In their "Lo quiero" (by title). */
  wanted: z.boolean(),
});

export type FreeGame = z.infer<typeof FreeGameSchema>;

/** Response of GET /api/deals/free. */
export const FreeGamesResponseSchema = z.object({
  /** The ones ending soonest first. */
  items: z.array(FreeGameSchema),
  updatedAt: z.iso.datetime().nullable(),
});

export type FreeGamesResponse = z.infer<typeof FreeGamesResponseSchema>;
