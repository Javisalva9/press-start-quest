import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AddManualGameRequestSchema,
  LibraryQuerySchema,
  ReviewAnswerRequestSchema,
  ReviewQueueQuerySchema,
  UpdateLengthRequestSchema,
  UpdateLibraryGameRequestSchema,
  type AddManualGameRequest,
  type LibraryGame,
  type LibraryPage,
  type LibraryQuery,
  type ReviewAnswerRequest,
  type ReviewQueue,
  type ReviewQueueQuery,
  type UpdateLengthRequest,
  type UpdateLibraryGameRequest,
} from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { LibraryService } from './library.service.js';
import { ManualGamesService } from './manual-games.service.js';
import { ReviewService } from './review.service.js';

@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly review: ReviewService,
    private readonly manual: ManualGamesService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'A page of the library, filtered and sorted' })
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: LibraryQuerySchema }) query: LibraryQuery,
  ): Promise<LibraryPage> {
    return this.library.list(user.id, query);
  }

  @Post('manual')
  @ApiOkResponse({ description: 'The game, added to the library' })
  addManual(
    @CurrentUser() user: AuthUser,
    @Body({ schema: AddManualGameRequestSchema }) body: AddManualGameRequest,
  ): Promise<LibraryGame> {
    return this.manual.add(user.id, body);
  }

  // Before ':id', or "review-queue" would be taken for a game id.
  @Get('review-queue')
  @ApiOkResponse({ description: 'Games waiting for "did you finish it?"' })
  reviewQueue(
    @CurrentUser() user: AuthUser,
    @Query({ schema: ReviewQueueQuerySchema }) query: ReviewQueueQuery,
  ): Promise<ReviewQueue> {
    return this.review.queue(user.id, query.limit);
  }

  @Post('review-queue/:id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Answer saved' })
  answerReview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: ReviewAnswerRequestSchema }) body: ReviewAnswerRequest,
  ): Promise<void> {
    return this.review.answer(user.id, id, body);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Everything about one game of the library' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<LibraryGame> {
    return this.library.get(user.id, id);
  }

  @Patch(':id/length')
  @ApiOkResponse({ description: 'The game, with its new length' })
  setLength(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: UpdateLengthRequestSchema }) body: UpdateLengthRequest,
  ): Promise<LibraryGame> {
    return this.library.setLength(user.id, id, body.minutes);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'The game, with the changes' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: UpdateLibraryGameRequestSchema })
    body: UpdateLibraryGameRequest,
  ): Promise<LibraryGame> {
    return this.library.update(user.id, id, body);
  }
}
