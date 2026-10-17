import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { CuratorSummary, CuratorsResponse } from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { CuratorsService } from './curators.service.js';

@ApiTags('curators')
@ApiBearerAuth()
@Controller('curators')
export class CuratorsController {
  constructor(private readonly curators: CuratorsService) {}

  @Get()
  @ApiOkResponse({ description: 'Curators to follow, with their numbers' })
  async list(@CurrentUser() user: AuthUser): Promise<CuratorsResponse> {
    return { curators: await this.curators.list(user.id) };
  }

  @Post(':id/follow')
  @ApiOkResponse({ description: 'Followed: its games are in "Lo quiero"' })
  follow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<CuratorSummary> {
    return this.curators.follow(user.id, id);
  }

  @Delete(':id/follow')
  @ApiOkResponse({ description: 'Unfollowed: its untouched games are gone' })
  unfollow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<CuratorSummary> {
    return this.curators.unfollow(user.id, id);
  }
}
