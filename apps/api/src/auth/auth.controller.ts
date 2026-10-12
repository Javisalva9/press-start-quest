import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Redirect,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  RefreshTokenRequestSchema,
  SteamLoginRequestSchema,
  type AuthTokens,
  type RefreshTokenRequest,
  type SteamLoginRequest,
} from '@psq/shared';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('steam')
  @Redirect()
  @ApiResponse({
    status: 302,
    description: 'Redirects to the Steam sign-in page',
  })
  steam(): { url: string } {
    return { url: this.auth.steamLoginUrl() };
  }

  @Post('steam')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Signed in: returns access and refresh tokens',
  })
  login(
    @Body({ schema: SteamLoginRequestSchema }) body: SteamLoginRequest,
  ): Promise<AuthTokens> {
    return this.auth.loginWithSteam(body);
  }

  // Public: it must work precisely when the access token has expired.
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ description: 'New access and refresh tokens' })
  refresh(
    @Body({ schema: RefreshTokenRequestSchema }) body: RefreshTokenRequest,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Session closed on this device' })
  logout(
    @Body({ schema: RefreshTokenRequestSchema }) body: RefreshTokenRequest,
  ): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }
}
