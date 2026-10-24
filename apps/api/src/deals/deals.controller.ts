import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { DealsResponse, FreeGamesResponse } from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { DealsService } from './deals.service.js';
import { FreeGamesService } from './free-games.service.js';

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly freeGames: FreeGamesService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'The priced games of your wishlist' })
  list(@CurrentUser() user: AuthUser): Promise<DealsResponse> {
    return this.deals.list(user.id);
  }

  @Get('free')
  @ApiOkResponse({ description: 'Games given away now in official stores' })
  free(@CurrentUser() user: AuthUser): Promise<FreeGamesResponse> {
    return this.freeGames.list(user.id);
  }
}
