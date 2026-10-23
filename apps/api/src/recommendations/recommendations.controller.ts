import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  NextRecommendationQuerySchema,
  RecommendationFeedbackRequestSchema,
  RecommendationRankingQuerySchema,
  type NextRecommendation,
  type NextRecommendationQuery,
  type RecommendationFeedback,
  type RecommendationFeedbackRequest,
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

  @Post(':id/feedback')
  @HttpCode(200)
  @ApiOkResponse({ description: '"Not now" or "I won\'t play it", saved' })
  feedback(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: RecommendationFeedbackRequestSchema })
    body: RecommendationFeedbackRequest,
  ): Promise<RecommendationFeedback> {
    return this.recommendations.feedback(user.id, id, body);
  }
}
