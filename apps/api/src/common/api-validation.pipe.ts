import {
  BadRequestException,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import type { ApiError } from '@psq/shared';

/**
 * Validates request bodies, queries and params against the zod schema given
 * in the decorator, e.g. `@Body({ schema: SteamLoginRequestSchema })`.
 * On failure it answers 400 with the shared error shape and code.
 */
export class ApiValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({
      exceptionFactory: (issues) =>
        new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          details: issues.map((issue) => {
            const path = (issue.path ?? [])
              .map((segment) =>
                typeof segment === 'object'
                  ? String(segment.key)
                  : String(segment),
              )
              .join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
          }),
        } satisfies ApiError),
    });
  }
}
