import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  LibraryQuerySchema,
  type LibraryGame,
  type LibraryPage,
  type LibraryQuery,
} from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { LibraryService } from './library.service.js';

@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ApiOkResponse({ description: 'A page of the library, filtered and sorted' })
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: LibraryQuerySchema }) query: LibraryQuery,
  ): Promise<LibraryPage> {
    return this.library.list(user.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Everything about one game of the library' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<LibraryGame> {
    return this.library.get(user.id, id);
  }
}
