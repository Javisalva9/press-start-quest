import { createHash, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiError } from '@psq/shared';
import type { Request } from 'express';
import type { Env } from '../config/env.js';

/**
 * Lets in only who knows JOBS_TOKEN: the nightly workflow on GitHub. With
 * no token configured the internal routes don't exist (404), so a local
 * API without it can't be woken up from outside.
 */
@Injectable()
export class JobsTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get('JOBS_TOKEN', { infer: true });
    if (!expected) {
      throw new NotFoundException();
    }
    const request = context.switchToHttp().getRequest<Request>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token || !sameSecret(token, expected)) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      } satisfies ApiError);
    }
    return true;
  }
}

/**
 * Compares in constant time, so the response time doesn't tell how many
 * characters were right. Hashing first gives both sides the same length,
 * which timingSafeEqual needs, without revealing the token's.
 */
function sameSecret(given: string, expected: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(given), hash(expected));
}
