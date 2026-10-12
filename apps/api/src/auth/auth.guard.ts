import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ApiError } from '@psq/shared';
import type { AccessTokenPayload } from './access-token.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Global guard: every route needs `Authorization: Bearer <access token>`
 * unless it's marked with @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw unauthenticated();
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        // Only the algorithm we sign with: rejects tokens that claim another one.
        algorithms: ['HS256'],
      });
      request.user = { id: payload.sub };
    } catch {
      // Expired, tampered with or signed with another secret.
      throw unauthenticated();
    }
    return true;
  }
}

function unauthenticated(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    code: 'UNAUTHENTICATED',
  } satisfies ApiError);
}
