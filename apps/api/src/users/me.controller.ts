import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Me } from '@psq/shared';
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
}
