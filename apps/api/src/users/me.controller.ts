import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  UpdateMeRequestSchema,
  type Me,
  type UpdateMeRequest,
} from '@psq/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ description: 'The signed-in user' })
  me(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.users.getMe(user.id);
  }

  @Patch()
  @ApiOkResponse({ description: 'The signed-in user, with the changes' })
  update(
    @CurrentUser() user: AuthUser,
    @Body({ schema: UpdateMeRequestSchema }) body: UpdateMeRequest,
  ): Promise<Me> {
    return this.users.updateMe(user.id, body);
  }
}
