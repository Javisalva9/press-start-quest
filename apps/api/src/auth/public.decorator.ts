import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Opens a route (or a whole controller) to anonymous users.
 * Every other route requires a valid access token: forgetting a decorator
 * can never leave private data exposed.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
