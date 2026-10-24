import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  StatsMilestones,
  StatsOverview,
  StatsTimeline,
} from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { StatsService } from './stats.service.js';

@ApiTags('stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Progress counts and streaks' })
  overview(@CurrentUser() user: AuthUser): Promise<StatsOverview> {
    return this.stats.overview(user.id);
  }

  @Get('timeline')
  @ApiOkResponse({ description: 'Completed games and hours played per month' })
  timeline(@CurrentUser() user: AuthUser): Promise<StatsTimeline> {
    return this.stats.timeline(user.id);
  }

  @Get('milestones')
  @ApiOkResponse({ description: 'Milestones reached and the next ones' })
  milestones(@CurrentUser() user: AuthUser): Promise<StatsMilestones> {
    return this.stats.milestones(user.id);
  }
}
