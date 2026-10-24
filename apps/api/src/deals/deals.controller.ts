import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { DealsResponse } from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { DealsService } from './deals.service.js';

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  @ApiOkResponse({ description: 'The priced games of your wishlist' })
  list(@CurrentUser() user: AuthUser): Promise<DealsResponse> {
    return this.deals.list(user.id);
  }
}
