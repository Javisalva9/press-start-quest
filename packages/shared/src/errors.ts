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
