import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** What the API knows about the caller, read from their access token. */
export interface AuthUser {
  id: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

/** Injects the signed-in user into a route handler: `me(@CurrentUser() user)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
