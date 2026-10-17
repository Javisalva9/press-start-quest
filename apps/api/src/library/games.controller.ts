import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  GameSearchQuerySchema,
  type GameSearchQuery,
  type GameSearchResponse,
} from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { ManualGamesService } from './manual-games.service.js';

@ApiTags('games')
@ApiBearerAuth()
@Controller('games')
export class GamesController {
  constructor(private readonly manual: ManualGamesService) {}

  @Get('search')
  @ApiOkResponse({ description: 'PC games on IGDB matching the text' })
  async search(
    @CurrentUser() user: AuthUser,
    @Query({ schema: GameSearchQuerySchema }) query: GameSearchQuery,
  ): Promise<GameSearchResponse> {
    return { results: await this.manual.search(user.id, query.q) };
  }
}
