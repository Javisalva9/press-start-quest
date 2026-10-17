import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  FinaleVoteRequestSchema,
  type FinaleVoteRequest,
  type GameAchievement,
  type GameAchievementsResponse,
} from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { AchievementsService } from './achievements.service.js';

/** Under /library/:id, next to the game page they belong to. */
@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get(':id/achievements')
  @ApiOkResponse({ description: 'The game achievements, unlocked first' })
  async list(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<GameAchievementsResponse> {
    return { achievements: await this.achievements.list(user.id, id) };
  }

  @Put(':id/achievements/:achievementId/finale-vote')
  @ApiOkResponse({ description: 'The achievement, with the vote counted' })
  vote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('achievementId') achievementId: string,
    @Body({ schema: FinaleVoteRequestSchema }) body: FinaleVoteRequest,
  ): Promise<GameAchievement> {
    return this.achievements.vote(user.id, id, achievementId, body);
  }
}
