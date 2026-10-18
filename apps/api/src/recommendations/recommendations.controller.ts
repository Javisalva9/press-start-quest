import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  NextRecommendationQuerySchema,
  RecommendationRankingQuerySchema,
  type NextRecommendation,
  type NextRecommendationQuery,
  type RecommendationRanking,
  type RecommendationRankingQuery,
} from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { RecommendationsService } from './recommendations.service.js';

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get('next')
  @ApiOkResponse({ description: 'Your next game and two of other genres' })
  next(
    @CurrentUser() user: AuthUser,
    @Query({ schema: NextRecommendationQuerySchema })
    query: NextRecommendationQuery,
  ): Promise<NextRecommendation> {
    return this.recommendations.next(user.id, query.mood ?? null, query.skip);
  }

  @Get('ranking')
  @ApiOkResponse({ description: 'The best candidates, with every factor' })
  ranking(
    @CurrentUser() user: AuthUser,
    @Query({ schema: RecommendationRankingQuerySchema })
    query: RecommendationRankingQuery,
  ): Promise<RecommendationRanking> {
    return this.recommendations.ranking(
      user.id,
      query.mood ?? null,
      query.limit,
    );
  }
}
