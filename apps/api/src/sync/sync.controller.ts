import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { SyncJob } from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { SyncService } from './sync.service.js';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post()
  // 202 Accepted: the work has started, but it isn't finished yet.
  @HttpCode(202)
  @ApiAcceptedResponse({ description: 'Sync started (or already running)' })
  start(@CurrentUser() user: AuthUser): Promise<SyncJob> {
    return this.sync.start(user.id);
  }

  @Get('jobs/:id')
  @ApiOkResponse({ description: 'Progress and result of a sync' })
  job(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<SyncJob> {
    return this.sync.getJob(user.id, id);
  }
}
