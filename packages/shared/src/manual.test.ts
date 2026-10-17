import { describe, expect, it } from 'vitest';
import { AddManualGameRequestSchema, GameSearchQuerySchema } from './manual.js';

describe('GameSearchQuerySchema', () => {
  it('needs at least two characters, trimmed', () => {
    expect(GameSearchQuerySchema.safeParse({ q: ' h ' }).success).toBe(false);
    expect(GameSearchQuerySchema.parse({ q: ' hades ' })).toEqual({
      q: 'hades',
    });
  });
});

describe('AddManualGameRequestSchema', () => {
  it('takes a wishlist entry with just the game', () => {
    expect(
      AddManualGameRequestSchema.safeParse({ origin: 'wishlist', igdbId: 1 })
        .success,
    ).toBe(true);
  });

  it('takes an owned game with its source, playtime and status', () => {
    expect(
      AddManualGameRequestSchema.parse({
        origin: 'external',
        igdbId: 1,
        sourceName: '  Jack Sparrow ',
        playtimeMinutes: 600,
        status: 'COMPLETED',
      }),
    ).toMatchObject({ sourceName: 'Jack Sparrow' });
  });

  it('needs a source name for an owned game', () => {
    expect(
      AddManualGameRequestSchema.safeParse({ origin: 'external', igdbId: 1 })
        .success,
    ).toBe(false);
    expect(
      AddManualGameRequestSchema.safeParse({
        origin: 'external',
        igdbId: 1,
        sourceName: '   ',
      }).success,
    ).toBe(false);
  });

  it('rejects a wishlist status', () => {
    expect(
      AddManualGameRequestSchema.safeParse({
        origin: 'external',
        igdbId: 1,
        sourceName: 'Epic',
        status: 'WISHLIST',
      }).success,
    ).toBe(false);
  });
});
