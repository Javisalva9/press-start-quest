import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { TasteProfile } from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { TasteProfileService } from './taste-profile.service.js';

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('taste-profile')
export class TasteProfileController {
  constructor(private readonly taste: TasteProfileService) {}

  @Get()
  @ApiOkResponse({
    description: 'Favourite genres, themes, modes and perspectives',
  })
  get(@CurrentUser() user: AuthUser): Promise<TasteProfile> {
    return this.taste.profile(user.id);
  }
}
