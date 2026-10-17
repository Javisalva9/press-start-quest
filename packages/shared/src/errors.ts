import { z } from 'zod';

/**
 * Error codes the API returns in the `code` field of every error response.
 * The web app turns them into translated messages: the API never sends
 * sentences meant for the user.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'REFRESH_TOKEN_INVALID',
  'STEAM_LOGIN_INVALID',
  'STEAM_UNAVAILABLE',
  'STEAM_ACCOUNT_NOT_LINKED',
  'STEAM_LIBRARY_PRIVATE',
  'SYNC_JOB_NOT_FOUND',
  'SYNC_INTERRUPTED',
  'SYNC_FAILED',
  'LIBRARY_GAME_NOT_FOUND',
  'LIBRARY_GAME_NOT_OWNED',
  'LIBRARY_GAME_ALREADY_OWNED',
  'LIBRARY_GAME_NOT_WISHED',
  'CURATOR_NOT_FOUND',
  'ACHIEVEMENT_NOT_FOUND',
  'IGDB_GAME_NOT_FOUND',
  'IGDB_UNAVAILABLE',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** Body of every error response from the API. */
export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: ErrorCodeSchema,
  /** Details for developers (e.g. which field failed validation). */
  details: z.array(z.string()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
