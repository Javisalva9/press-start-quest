import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Redirect,
} from '@nestjs/common';
import { ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  SteamLoginRequestSchema,
  type AuthTokens,
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
  @ApiOkResponse({ description: 'Signed in: returns an access token' })
  login(
    @Body({ schema: SteamLoginRequestSchema }) body: SteamLoginRequest,
  ): Promise<AuthTokens> {
    return this.auth.loginWithSteam(body);
  }
}
