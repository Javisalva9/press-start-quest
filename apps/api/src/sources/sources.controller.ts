import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { SteamPrivacy } from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { SteamPrivacyService } from './steam-privacy.service.js';

@ApiTags('sources')
@ApiBearerAuth()
@Controller('sources')
export class SourcesController {
  constructor(private readonly steamPrivacy: SteamPrivacyService) {}

  @Get('steam/privacy')
  @ApiOkResponse({
    description: 'Whether the Steam profile lets the app read the library',
  })
  steamPrivacyStatus(@CurrentUser() user: AuthUser): Promise<SteamPrivacy> {
    return this.steamPrivacy.check(user.id);
  }
}
