import { z } from 'zod';

/** Same values as the GameStatus enum in the database. */
export const GAME_STATUSES = [
  'BACKLOG',
  'PLAYING',
  'COMPLETED',
  'ABANDONED',
  'ON_HOLD',
  'WISHLIST',
  'DISCARDED',
] as const;

export const GameStatusSchema = z.enum(GAME_STATUSES);

export type GameStatus = z.infer<typeof GameStatusSchema>;

/** Same values as the Platform enum in the database. */
export const PLATFORMS = ['STEAM', 'EPIC', 'EXTERNAL'] as const;

export const PlatformSchema = z.enum(PLATFORMS);

export type Platform = z.infer<typeof PlatformSchema>;

/**
 * Length buckets, by the "normal" length (main story + extras):
 * short < 10 h, medium 10–30 h, long > 30 h, unknown when nobody knows.
 */
export const LENGTH_BUCKETS = ['short', 'medium', 'long', 'unknown'] as const;

export type LengthBucket = (typeof LENGTH_BUCKETS)[number];

export const LIBRARY_SORTS = [
  'lastPlayed',
  'title',
  'playtime',
  'rating',
  'length',
  'added',
  'priority',
] as const;

export type LibrarySort = (typeof LIBRARY_SORTS)[number];

/** "BACKLOG,PLAYING" in the URL → ['BACKLOG', 'PLAYING']. */
const commaSeparated = <const T extends readonly [string, ...string[]]>(
  values: T,
) =>
  z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1));

/** Query string of GET /api/library. */
export const LibraryQuerySchema = z.object({
  /** Owned games, or the wishlist ("Lo quiero"). */
  view: z.enum(['library', 'wishlist']).default('library'),
  status: commaSeparated(GAME_STATUSES).optional(),
  source: PlatformSchema.optional(),
  length: z.enum(LENGTH_BUCKETS).optional(),
  /** Text to find in the title. */
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(LIBRARY_SORTS).default('lastPlayed'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type LibraryQuery = z.infer<typeof LibraryQuerySchema>;

/** A game in the library list. */
export const LibraryItemSchema = z.object({
  /** Id of the library entry (not of the catalog game). */
  id: z.string(),
  title: z.string(),
  /** 3:4 cover from IGDB. */
  coverUrl: z.string().nullable(),
  /** Wide Steam header, the fallback when there's no cover. */
  heroUrl: z.string().nullable(),
  status: GameStatusSchema,
  owned: z.boolean(),
  playtimeMinutes: z.number().int().nonnegative(),
  lastPlayedAt: z.iso.datetime().nullable(),
  /** "Normal" length in minutes (main story + extras), if known. */
  lengthMinutes: z.number().int().nullable(),
  /** 0–100. */
  rating: z.number().nullable(),
  achievements: z
    .object({ unlocked: z.number().int(), total: z.number().int() })
    .nullable(),
  wishlistPriority: z.number().int().nullable(),
  /** Stores where the user has it. */
  sources: z.array(PlatformSchema),
});

export type LibraryItem = z.infer<typeof LibraryItemSchema>;

/** Response of GET /api/library. */
export const LibraryPageSchema = z.object({
  items: z.array(LibraryItemSchema),
  /** Entries matching the filters, across all pages. */
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type LibraryPage = z.infer<typeof LibraryPageSchema>;

/** Response of GET /api/library/:id: everything for the game's page. */
export const LibraryGameSchema = LibraryItemSchema.extend({
  summary: z.string().nullable(),
  developer: z.string().nullable(),
  releaseDate: z.iso.datetime().nullable(),
  ratingCount: z.number().int().nullable(),
  metacritic: z.number().int().nullable(),
  steamAppId: z.number().int().nullable(),
  /** Lengths in minutes, and where they come from (igdb | manual). */
  timeToBeat: z.object({
    mainMinutes: z.number().int().nullable(),
    extraMinutes: z.number().int().nullable(),
    completeMinutes: z.number().int().nullable(),
    source: z.string().nullable(),
  }),
  genres: z.array(z.string()),
  themes: z.array(z.string()),
  modes: z.array(z.string()),
  perspectives: z.array(z.string()),
  /** Playtime per store. */
  ownerships: z.array(
    z.object({
      platform: PlatformSchema,
      playtimeMinutes: z.number().int().nonnegative(),
      lastPlayedAt: z.iso.datetime().nullable(),
    }),
  ),
});

export type LibraryGame = z.infer<typeof LibraryGameSchema>;

/**
 * Body of PATCH /api/library/:id/length: the game's "normal" length typed
 * in by the user, in minutes, or null to go back to IGDB's.
 */
export const UpdateLengthRequestSchema = z.object({
  minutes: z.number().int().min(1).max(100_000).nullable(),
});

export type UpdateLengthRequest = z.infer<typeof UpdateLengthRequestSchema>;
