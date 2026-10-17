import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ExternalSourcesResponse, SteamPrivacy } from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { ExternalSourcesService } from './external-sources.service.js';
import { SteamPrivacyService } from './steam-privacy.service.js';

@ApiTags('sources')
@ApiBearerAuth()
@Controller('sources')
export class SourcesController {
  constructor(
    private readonly steamPrivacy: SteamPrivacyService,
    private readonly externalSources: ExternalSourcesService,
  ) {}

  @Get('steam/privacy')
  @ApiOkResponse({
    description: 'Whether the Steam profile lets the app read the library',
  })
  steamPrivacyStatus(@CurrentUser() user: AuthUser): Promise<SteamPrivacy> {
    return this.steamPrivacy.check(user.id);
  }

  @Get('external')
  @ApiOkResponse({ description: 'Stores added by hand, with no sync' })
  async external(
    @CurrentUser() user: AuthUser,
  ): Promise<ExternalSourcesResponse> {
    return { sources: await this.externalSources.list(user.id) };
  }
}
