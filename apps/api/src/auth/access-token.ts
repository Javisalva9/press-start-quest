/** Content of an access token (a JWT signed with JWT_SECRET). */
export interface AccessTokenPayload {
  /** User id: "sub" (subject) is the standard JWT field for it. */
  sub: string;
}

/**
 * Access tokens are short-lived: a stolen one is only useful for a while.
 * The app gets new ones with its refresh token (see SessionsService).
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
