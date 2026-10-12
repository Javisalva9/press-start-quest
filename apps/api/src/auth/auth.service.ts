import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  DEFAULT_LANGUAGE,
  type ApiError,
  type AuthTokens,
  type SteamLoginRequest,
} from '@psq/shared';
import type { Env } from '../config/env.js';
import { SteamWebApi } from '../providers/steam/steam-web-api.js';
import { UsersService } from '../users/users.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type AccessTokenPayload,
} from './access-token.js';
import { RefreshTokenError, SessionsService } from './sessions.service.js';
import {
  SteamLoginError,
  buildSteamLoginUrl,
  verifySteamLogin,
} from './steam-openid.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly webUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
    private readonly steam: SteamWebApi,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/+$/, '');
  }

  /** Steam page where the user signs in. Steam then sends them to the web app. */
  steamLoginUrl(): string {
    return buildSteamLoginUrl(this.steamReturnTo(), this.webUrl);
  }

  /**
   * Checks what Steam sent back, finds or creates the user and opens a
   * session on this device.
   */
  async loginWithSteam({
    query,
    language,
  }: SteamLoginRequest): Promise<AuthTokens> {
    let steamId: string;
    try {
      steamId = await verifySteamLogin(query, this.steamReturnTo());
    } catch (error) {
      if (error instanceof SteamLoginError) {
        this.logger.warn(`Rejected Steam sign-in: ${error.message}`);
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'STEAM_LOGIN_INVALID',
        } satisfies ApiError);
      }
      this.logger.error(
        `Could not verify a Steam sign-in: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'STEAM_UNAVAILABLE',
      } satisfies ApiError);
    }

    const user = await this.users.findOrCreateBySteamId(steamId, {
      displayName: await this.steamDisplayName(steamId),
      language: language ?? DEFAULT_LANGUAGE,
    });
    return this.issueTokens(user.id, await this.sessions.create(user.id));
  }

  /** Swaps a refresh token for a new pair of tokens. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const session = await this.sessions.rotate(refreshToken);
      return this.issueTokens(session.userId, session.refreshToken);
    } catch (error) {
      if (error instanceof RefreshTokenError) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'REFRESH_TOKEN_INVALID',
        } satisfies ApiError);
      }
      throw error;
    }
  }

  /** Signs out the device that holds this refresh token. */
  logout(refreshToken: string): Promise<void> {
    return this.sessions.revoke(refreshToken);
  }

  /** Where Steam sends the user back: a page of the web app. */
  private steamReturnTo(): string {
    return `${this.webUrl}/auth/steam/callback`;
  }

  /** Steam name of the user. Nice to have: if Steam fails, sign-in goes on. */
  private async steamDisplayName(steamId: string): Promise<string | null> {
    try {
      const summary = await this.steam.getPlayerSummary(steamId);
      return summary?.personaname ?? null;
    } catch (error) {
      this.logger.warn(
        `Could not read the Steam profile: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async issueTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const payload: AccessTokenPayload = { sub: userId };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, refreshToken };
  }
}
