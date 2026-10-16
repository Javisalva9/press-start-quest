import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { JobsTokenGuard } from './jobs-token.guard.js';

const TOKEN = 'a'.repeat(48);

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  }) as unknown as ExecutionContext;

const guardWith = (token: string | undefined) =>
  new JobsTokenGuard({ get: () => token } as unknown as ConfigService<
    Env,
    true
  >);

describe('JobsTokenGuard', () => {
  it('lets in the right token', () => {
    expect(guardWith(TOKEN).canActivate(contextWith(`Bearer ${TOKEN}`))).toBe(
      true,
    );
  });

  it.each([
    ['no header', undefined],
    ['another token', `Bearer ${'b'.repeat(48)}`],
    ['a shorter one', 'Bearer abc'],
    ['another scheme', `Basic ${TOKEN}`],
  ])('answers 401 with %s', (_case, header) => {
    expect(() => guardWith(TOKEN).canActivate(contextWith(header))).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it('hides the routes (404) when no token is configured', () => {
    expect(() =>
      guardWith(undefined).canActivate(contextWith(`Bearer ${TOKEN}`)),
    ).toThrow(expect.objectContaining({ status: 404 }));
  });
});
